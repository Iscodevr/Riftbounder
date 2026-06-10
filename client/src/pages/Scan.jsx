import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import CardModal from "../components/CardModal";

const SCAN_INTERVAL_MS = 2500;
const COOLDOWN_MS = 6000;
const DETECT_INTERVAL_MS = 200;
const DETECT_WIDTH = 320;

// Détecte le plus grand quadrilatère (contour de carte) dans l'image
function detectCardContour(cv, src) {
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.dilate(edges, edges, kernel);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const minArea = src.rows * src.cols * 0.15;
  let best = null;
  let bestArea = 0;

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area >= minArea) {
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
      if (approx.rows === 4 && area > bestArea) {
        bestArea = area;
        if (best) best.delete();
        best = approx;
      } else {
        approx.delete();
      }
    }
    cnt.delete();
  }

  gray.delete(); edges.delete(); kernel.delete(); contours.delete(); hierarchy.delete();

  if (!best) return null;
  const points = [];
  for (let i = 0; i < 4; i++) {
    points.push({ x: best.intPtr(i, 0)[0], y: best.intPtr(i, 0)[1] });
  }
  best.delete();
  return points;
}

// Canvas plein + contraste
function preprocessCanvas(video, canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.filter = "grayscale(1) contrast(1.8) brightness(1.1)";
  ctx.drawImage(video, 0, 0);
  ctx.filter = "none";
}

// Canvas réduit au 25% du bas (zone numéro de carte)
function cropBottom(video, canvas) {
  const ctx = canvas.getContext("2d");
  const sy = Math.floor(video.videoHeight * 0.75);
  const sh = video.videoHeight - sy;
  canvas.width = video.videoWidth;
  canvas.height = sh;
  ctx.filter = "grayscale(1) contrast(2) brightness(1.2)";
  ctx.drawImage(video, 0, sy, video.videoWidth, sh, 0, 0, video.videoWidth, sh);
  ctx.filter = "none";
}

// Canvas réduit au 30% du haut (zone nom de carte)
function cropTop(video, canvas) {
  const ctx = canvas.getContext("2d");
  const sh = Math.floor(video.videoHeight * 0.30);
  canvas.width = video.videoWidth;
  canvas.height = sh;
  ctx.filter = "grayscale(1) contrast(1.8) brightness(1.1)";
  ctx.drawImage(video, 0, 0, video.videoWidth, sh, 0, 0, video.videoWidth, sh);
  ctx.filter = "none";
}

export default function Scan() {
  const api = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const detectCanvasRef = useRef(null);
  const loopRef = useRef(null);
  const detectLoopRef = useRef(null);
  const cvRef = useRef(null);
  const cardDetectedRef = useRef(false);
  const detectStreakRef = useRef(0);
  const lastAddedRef = useRef({ id: null, ts: 0 });
  const tesseractRef = useRef(null);
  const scanningRef = useRef(false);

  const [streaming, setStreaming] = useState(false);
  const [autoActive, setAutoActive] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [lastAdded, setLastAdded] = useState(null);
  const [library, setLibrary] = useState({});
  const [toast, setToast] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrDebug, setOcrDebug] = useState(null);
  const [cardDetected, setCardDetected] = useState(false);
  const [tab, setTab] = useState("scan");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(null);
  // Pour apprendre un nom FR après confirmation
  const [pendingFrName, setPendingFrName] = useState(null); // { card, rawText }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    loadLibrary();
    return () => { stopLoop(); stopCamera(); };
  }, [user]);

  const loadLibrary = () => {
    api.get("/library", { limit: 9999 }).then((data) => {
      const map = {};
      data.cards.forEach((c) => { map[c.id] = c.quantity; });
      setLibrary(map);
    }).catch(console.error);
  };

  const getTesseract = async () => {
    if (!tesseractRef.current) {
      const mod = await import("tesseract.js");
      tesseractRef.current = mod.default;
    }
    return tesseractRef.current;
  };

  const getOpenCV = async () => {
    if (!cvRef.current) {
      const mod = await import("@techstark/opencv-js");
      cvRef.current = await mod.default;
    }
    return cvRef.current;
  };

  // Dessine le contour détecté (ou les coins statiques) sur le canvas overlay
  const drawOverlay = (points) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!points) return;

    ctx.lineWidth = Math.max(3, canvas.width * 0.006);
    ctx.strokeStyle = "#4ade80";
    ctx.fillStyle = "rgba(74, 222, 128, 0.12)";
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#4ade80";
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth * 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const startDetectLoop = async () => {
    try {
      const cv = await getOpenCV();
      if (!detectCanvasRef.current) detectCanvasRef.current = document.createElement("canvas");

      detectLoopRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !video.videoWidth) return;

        const scale = DETECT_WIDTH / video.videoWidth;
        const w = DETECT_WIDTH;
        const h = Math.round(video.videoHeight * scale);
        const dCanvas = detectCanvasRef.current;
        dCanvas.width = w;
        dCanvas.height = h;
        const dCtx = dCanvas.getContext("2d");
        dCtx.drawImage(video, 0, 0, w, h);

        let src;
        try {
          src = cv.imread(dCanvas);
          const points = detectCardContour(cv, src);
          src.delete();

          if (points) {
            detectStreakRef.current = Math.min(detectStreakRef.current + 1, 3);
          } else {
            detectStreakRef.current = 0;
          }
          const detected = detectStreakRef.current >= 2;
          cardDetectedRef.current = detected;
          setCardDetected(detected);

          drawOverlay(points ? points.map((p) => ({ x: p.x / scale, y: p.y / scale })) : null);
        } catch (e) {
          src?.delete();
        }
      }, DETECT_INTERVAL_MS);
    } catch (e) {
      console.error("OpenCV load error:", e);
    }
  };

  const stopDetectLoop = () => {
    clearInterval(detectLoopRef.current);
    detectLoopRef.current = null;
    cardDetectedRef.current = false;
    detectStreakRef.current = 0;
    setCardDetected(false);
    const canvas = overlayCanvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1080 }, height: { ideal: 1440 } },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStreaming(true);
      startDetectLoop();
    } catch (e) {
      showToast("❌ Caméra inaccessible : " + e.message);
    }
  };

  const stopCamera = () => {
    stopLoop();
    stopDetectLoop();
    videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
    setAutoActive(false);
    setCandidates([]);
    setOcrStatus("");
  };

  const doScan = useCallback(async () => {
    if (scanningRef.current) return;
    if (!videoRef.current?.srcObject) return;
    if (videoRef.current.readyState < 2) return;

    scanningRef.current = true;
    setOcrStatus("Analyse…");

    try {
      const Tesseract = await getTesseract();
      const canvas = canvasRef.current;
      const video = videoRef.current;

      // Passe unique : image entière avec prétraitement
      preprocessCanvas(video, canvas);
      const { data } = await Tesseract.recognize(canvas, "fra+eng", { logger: () => {} });

      // Score de confiance global Tesseract (0-100)
      const confidence = data.confidence;

      // Si confiance < 30% → pas de carte visible, on ne fait rien
      if (confidence < 30) {
        setOcrStatus("Pas de texte lisible…");
        setCandidates([]);
        return;
      }

      const ocrText = data.text;
      setOcrDebug(`[conf:${confidence}%] ${ocrText.slice(0, 150)}`);

      // Envoyer au backend pour scoring multi-champs + filtrage
      const base = import.meta.env.VITE_API_URL || "";
      const result = await fetch(`${base}/api/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ocrText, confidence }),
      }).then((r) => r.json());

      const { candidates: found = [], reason } = result;

      if (found.length === 0) {
        const msg = reason === "low_confidence" ? `Pas de carte (conf. ${confidence}%)`
          : reason === "insufficient_signals" ? "Signaux insuffisants…"
          : "Aucune carte détectée…";
        setOcrStatus(msg);
        setCandidates([]);
        return;
      }

      if (found[0].matchType === "number") {
        const card = found[0];
        const now = Date.now();
        const { id: lastId, ts: lastTs } = lastAddedRef.current;
        if (card.id !== lastId || now - lastTs > COOLDOWN_MS) {
          setOcrStatus(`✅ ${card.name} — numéro détecté`);
          await doAdd(card, true);
          setCandidates([]);
        } else {
          setOcrStatus(`⏳ ${card.name} — cooldown actif`);
          setCandidates([card]);
        }
        return;
      }

      // Score suffisamment haut → auto-add
      if (found.length === 1 && found[0].score >= 70) {
        const card = found[0];
        const now = Date.now();
        const { id: lastId, ts: lastTs } = lastAddedRef.current;

        if (card.id !== lastId || now - lastTs > COOLDOWN_MS) {
          setOcrStatus(`✅ ${card.name} (score ${card.score}) — ajout`);
          await doAdd(card, true);
          // Proposer d'enregistrer le nom FR si non connu et texte OCR différent du nom EN
          if (!card.name_fr) {
            const firstLine = ocrText.split("\n").map((l) => l.trim()).find((l) => l.length > 3);
            if (firstLine && firstLine.toLowerCase() !== card.name.toLowerCase()) {
              setPendingFrName({ card, rawText: firstLine });
            }
          }
          setCandidates([]);
        } else {
          setOcrStatus(`⏳ ${card.name} — cooldown actif`);
          setCandidates([card]);
        }
        return;
      }

      // Plusieurs candidats ou score faible → afficher pour sélection
      setCandidates(found);
      setOcrStatus(
        found.length === 1
          ? `Résultat possible : ${found[0].name} (score ${found[0].score})`
          : `${found.length} candidats — sélectionnez la bonne carte`
      );

    } catch (e) {
      setOcrStatus("Erreur OCR");
      console.error(e);
    } finally {
      scanningRef.current = false;
    }
  }, []);

  const doAdd = async (card, auto = false) => {
    try {
      await api.post("/library", { card_id: card.id, quantity: 1 });
      setLibrary((l) => ({ ...l, [card.id]: (l[card.id] || 0) + 1 }));
      if (auto) {
        lastAddedRef.current = { id: card.id, ts: Date.now() };
        setLastAdded(card);
        setTimeout(() => setLastAdded(null), 2500);
      }
      showToast(`✅ ${card.name} ajoutée`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  const addExtra = async (card) => {
    lastAddedRef.current = { id: null, ts: 0 };
    await doAdd(card);
  };

  const saveFrName = async (card, name_fr) => {
    try {
      const base = import.meta.env.VITE_API_URL || "";
      await fetch(`${base}/api/identify/name-fr`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.id, name_fr }),
      });
      setPendingFrName(null);
      showToast(`✅ Nom FR "${name_fr}" enregistré`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  const startLoop = () => {
    setAutoActive(true);
    setCandidates([]);
    setOcrStatus("En attente de carte…");
    loopRef.current = setInterval(doScan, SCAN_INTERVAL_MS);
  };

  const stopLoop = () => {
    clearInterval(loopRef.current);
    loopRef.current = null;
    setAutoActive(false);
    setOcrStatus("");
    scanningRef.current = false;
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const data = await api.get("/cards", { q, limit: 12 });
      setSearchResults(data.cards);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  return (
    <div className="page">
      <h1 className="text-2xl font-bold text-white mb-6">Scanner une carte</h1>

      <div className="flex gap-2 mb-6">
        {["scan", "search"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}>
            {t === "scan" ? "📷 Scan auto" : "🔍 Recherche"}
          </button>
        ))}
      </div>

      {tab === "scan" && (
        <div className="space-y-4">
          {/* Viewfinder */}
          <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-[3/4] max-h-[70vh] mx-auto border border-gray-800">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

            {!streaming && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button onClick={startCamera} className="btn-primary text-lg px-8 py-4">📷 Activer la caméra</button>
              </div>
            )}

            {streaming && (
              <>
                {/* Contour de carte détecté en temps réel */}
                <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />

                {/* Cadre statique avec coins (visible tant qu'aucune carte n'est détectée) */}
                {!cardDetected && (
                  <div className="absolute inset-[10%] pointer-events-none">
                    {[["top-0 left-0 border-t-4 border-l-4 rounded-tl-lg", "-translate-x-0.5 -translate-y-0.5"],
                      ["top-0 right-0 border-t-4 border-r-4 rounded-tr-lg", "translate-x-0.5 -translate-y-0.5"],
                      ["bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg", "-translate-x-0.5 translate-y-0.5"],
                      ["bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg", "translate-x-0.5 translate-y-0.5"]
                    ].map(([cls, tr], i) => (
                      <div key={i} className={`absolute w-8 h-8 border-gold-400 ${cls} ${tr}`} />
                    ))}
                    {autoActive && (
                      <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gold-400/40 animate-pulse" />
                    )}
                  </div>
                )}

                {/* Statut en bas */}
                {ocrStatus && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[80%] bg-black/75 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm text-center">
                    {scanningRef.current && <span className="inline-block w-1.5 h-1.5 bg-gold-400 rounded-full animate-ping mr-1.5" />}
                    <span className="text-gold-300">{ocrStatus}</span>
                  </div>
                )}

                {/* Confirmation ajout automatique */}
                {lastAdded && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/85 text-white text-center px-6 py-5 rounded-2xl backdrop-blur-sm border border-green-500/40">
                      <div className="text-3xl mb-2">✅</div>
                      <div className="font-semibold">{lastAdded.name}</div>
                      <div className="text-xs text-gray-400 mt-1">×{library[lastAdded.id]} en collection</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Contrôles */}
          {streaming && (
            <div className="flex gap-3">
              {!autoActive
                ? <button onClick={startLoop} className="btn-primary flex-1 py-3">▶ Démarrer le scan</button>
                : <button onClick={stopLoop} className="flex-1 py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors">⏹ Arrêter</button>
              }
              <button onClick={stopCamera} className="btn-ghost px-4">Éteindre</button>
            </div>
          )}

          {autoActive && (
            <p className="text-xs text-center text-gray-600">
              Scan toutes les 2,5 s · Pointe le numéro en bas pour un match garanti · Fonctionne EN et FR
            </p>
          )}

          {/* Proposition d'apprendre un nom FR */}
          {pendingFrName && (
            <div className="bg-gray-900 border border-gold-500/40 rounded-xl p-4 space-y-2">
              <p className="text-sm text-gold-400 font-semibold">📚 Apprendre un nom français</p>
              <p className="text-xs text-gray-400">
                La carte <strong className="text-white">{pendingFrName.card.name}</strong> a été reconnue.<br />
                L'OCR a lu : <em className="text-gray-300">"{pendingFrName.rawText}"</em><br />
                Est-ce le nom français de cette carte ?
              </p>
              <div className="flex gap-2">
                <button onClick={() => saveFrName(pendingFrName.card, pendingFrName.rawText)} className="btn-primary text-xs px-3 py-1.5">
                  ✅ Oui, sauvegarder
                </button>
                <button onClick={() => setPendingFrName(null)} className="btn-ghost text-xs px-3 py-1.5">Non</button>
              </div>
            </div>
          )}

          {/* Candidats multiples */}
          {candidates.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-3">
                {candidates.length === 1 ? "Carte probable :" : "Sélectionnez la bonne carte :"}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {candidates.map((card) => (
                  <CandidateCard
                    key={card.id} card={card}
                    quantity={library[card.id] || 0}
                    score={card.score}
                    onAdd={() => { doAdd(card); lastAddedRef.current = { id: card.id, ts: Date.now() }; setCandidates([]); }}
                    onAddExtra={() => addExtra(card)}
                    onClick={() => setSelected(card)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "search" && (
        <div>
          <input
            className="input w-full text-base py-3"
            placeholder="Nom (FR ou EN) ou numéro ex: 042/298…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {searchResults.map((card) => (
                <CandidateCard
                  key={card.id} card={card}
                  quantity={library[card.id] || 0}
                  onAdd={() => doAdd(card)}
                  onAddExtra={() => addExtra(card)}
                  onClick={() => setSelected(card)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <CardModal
        card={selected}
        quantity={selected ? library[selected.id] || 0 : 0}
        onClose={() => setSelected(null)}
        onAdd={doAdd}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ card, quantity, score, onAdd, onAddExtra, onClick }) {
  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gold-500/60 transition-colors">
      <div className="cursor-pointer relative" onClick={onClick}>
        {card.image_small
          ? <img src={card.image_small} alt={card.name} className="w-full aspect-[2.5/3.5] object-cover" />
          : <div className="w-full aspect-[2.5/3.5] bg-gray-800 flex items-center justify-center text-gray-600 text-xs p-2">{card.name}</div>
        }
        {score != null && (
          <div className="absolute top-1.5 left-1.5 bg-black/70 text-xs text-gold-400 px-1.5 py-0.5 rounded-full">
            {score}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold text-white truncate">{card.name_fr || card.name}</p>
        {card.name_fr && <p className="text-xs text-gray-500 truncate">{card.name}</p>}
        <p className="text-xs text-gray-500 truncate">{card.set_name}</p>
      </div>
      <div className="px-2 pb-2 flex gap-1">
        {quantity === 0
          ? <button onClick={onAdd} className="flex-1 text-xs bg-gold-500 hover:bg-gold-400 text-gray-950 font-semibold py-1 rounded-lg transition-colors">+ Ajouter</button>
          : <>
              <span className="text-xs text-gold-400 font-semibold self-center flex-1">×{quantity}</span>
              <button onClick={onAddExtra} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-lg transition-colors">+1</button>
            </>
        }
      </div>
    </div>
  );
}

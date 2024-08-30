import { useState } from "react";
import { loadMscz } from "./mscore/init";
import "./App.css";
import { fetchBlob } from "./utils/fetch";
import { JSONTree } from "react-json-tree";
import WebMscore from "webmscore";
import { Synthesizer } from "./mscore/synthesizer";
import { Measures } from "./mscore/measures";
import { PositionElement } from "webmscore/schemas";
// import { Rect, SVG } from "@svgdotjs/svg.js";

type State = "idle" | "loading" | "playing" | "stopped";

function App() {
  const [state, setState] = useState<State>("idle");

  const [_mscore, setMscore] = useState<WebMscore | null>(null);
  const [synth, setSynth] = useState<Synthesizer | null>(null);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [measures, setMeasures] = useState<Measures | null>(null);

  const [scoreImgUrls, setScoreImgUrls] = useState<string[]>([]);
  const [currentElement, setCurrentElement] = useState<PositionElement | null>(
    null
  );
  const [meta, setMeta] = useState<object | null>(null);

  const load = async () => {
    if (state != "idle") return;
    setState("loading");

    // load the score
    const mscz = await fetchBlob("/test.mscz");
    const m = await loadMscz(mscz);

    // get metadata to display
    const meta = await m.metadata();

    // get the measure positions to highlight them when playing
    const mpos = await m.measurePositions();
    const msrs = new Measures(mpos);

    // prepare the synthesizer
    const s = new Synthesizer(m, meta.duration);
    const a = new AbortController();

    // render all pages as SVGs
    const si = [];
    const siu = [];
    for (let i = 0; i < meta.pages; i++) {
      const svg = await m.saveSvg(i, true /** drawPageBackground */);
      si.push(svg);

      const blob = new Blob([svg], { type: "image/svg+xml" });
      const blobUrl = URL.createObjectURL(blob);
      siu.push(blobUrl);
    }

    // update the state
    setMscore(m);
    setSynth(s);
    setAbortCtrl(a);

    setMeta(meta);
    setMeasures(msrs);

    setScoreImgUrls(siu);

    setState("stopped");
  };

  const play = async () => {
    if (state != "stopped") return;
    if (!synth) return;
    setState("playing");

    // This promise resolves when the score ends, or the user aborts
    await synth.play(abortCtrl?.signal, (time: number) => {
      const elm = measures?.getElByTime(time * 1000);

      // if (elm && elm?.id != currentElement?.id) {
      //   const { page, x, y, sx, sy } = elm;
      //   if (page != null) {
      //     const svg = SVG(`score-${page}`);
      //     const rect = new Rect()
      //       .size(sx, sy)
      //       .fill("none")
      //       .stroke({ color: "red", width: 2 });
      //     svg.add(rect).move(x, y);
      //   }
      // }

      setPlaybackTime(time);
      setCurrentElement(elm ?? null);
    });

    setState("stopped");
  };

  const stop = async () => {
    if (state != "playing") return;
    if (!synth) return;

    // The synth will stop playing when the promise resolves and the state is updated
    // there, but we should also update it here so that the user can't click "stop" again
    setState("stopped");

    abortCtrl?.abort();
  };

  const buttonClick = () => {
    switch (state) {
      case "idle":
        load();
        break;

      case "loading":
        break;

      case "stopped":
        play();
        break;

      case "playing":
        stop();
        break;
    }
  };

  const getButtonLabel = () => {
    switch (state) {
      case "idle":
        return "Load mscz";

      case "loading":
        return "Loading...";

      case "stopped":
        return "Play";

      case "playing":
        return "Stop";
    }
  };

  const buttonLabel = getButtonLabel();

  return (
    <div style={{ textAlign: "left" }}>
      <button disabled={state == "loading"} onClick={buttonClick}>
        {buttonLabel}
      </button>
      {state == "playing" ? (
        <div>Playback time: {playbackTime.toFixed(2)} s</div>
      ) : null}
      {currentElement != null ? <JSONTree data={currentElement} /> : null}
      {scoreImgUrls?.map((url, i) => (
        <img
          key={`scoreImg-${i}`}
          src={url}
          alt={`Page ${i}`}
          style={{ maxWidth: "100%" }}
        />
      ))}
      {meta != null ? <JSONTree data={meta} /> : null}
    </div>
  );
}

export default App;

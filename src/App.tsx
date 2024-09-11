import { useEffect, useState } from "react";
import { loadMscz } from "./mscore/init";
import "./App.css";
import { fetchBlob } from "./utils/fetch";
import { JSONTree } from "react-json-tree";
import WebMscore from "webmscore";
import { Synthesizer } from "./mscore/synthesizer";
import { Measures } from "./mscore/measures";
import { PositionElement } from "webmscore/schemas";
import { createSongBook } from "./createSongBook";
import { mock } from "./mock";
// import { Rect, SVG } from "@svgdotjs/svg.js";

type State = "idle" | "loading" | "playing" | "stopped";

const convertXMLStringToDocument = (xmlstring: string) => {
  return new DOMParser().parseFromString(xmlstring, "application/xml");
};

const convertXMLDocumentToByteArray = (xmlval: Document) => {
  // Convert xml string to base64data
  const base64Data = window.btoa(new XMLSerializer().serializeToString(xmlval));

  // Convert base64data to blob
  const byteCharacters = window.atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Uint8Array(byteNumbers);
};

const convertSvgStringToBlobUrl = (svgString: string) => {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const blobUrl = URL.createObjectURL(blob);
  return blobUrl;
};

const convertXMLByteArrayToBlob = (byteArray: Uint8Array) => {
  return new Blob([byteArray], { type: "application/xml" });
};

function App() {
  const [state, setState] = useState<State>("idle");

  const [_mscore, setMscore] = useState<WebMscore | null>(null);
  const [synth, setSynth] = useState<Synthesizer | null>(null);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [measures, setMeasures] = useState<Measures | null>(null);

  const [scoreSvgs, setScoreSvgs] = useState<string[]>([]);
  const [scoreImgUrls, setScoreImgUrls] = useState<string[]>([]);

  const [verovioSVG, setVerovioSVG] = useState<string>("");
  const [verovioBlobUrl, setVerovioBlobUrl] = useState<string>("");

  const [currentElement, setCurrentElement] = useState<PositionElement | null>(
    null,
  );
  const [meta, setMeta] = useState<object | null>(null);

  const load = async (msczUrl: string) => {
    setState("loading");

    // load the score
    const mscz = await fetchBlob(msczUrl);
    const m = await loadMscz(mscz);

    // save xml
    await m.saveXml().then((r) => {
      // console.log(r);

      const xml = new DOMParser().parseFromString(r, "text/xml");
      // console.log({ xml });

      // remove other parts, use only the first one
      [2, 3, 4, 5, 6, 7, 8, 9].forEach((index) => {
        xml.querySelectorAll(`#P${index}`).forEach((p) => p.remove());
      });

      const xmlString = new XMLSerializer().serializeToString(xml);
      // console.log({ xmlString });

      const vrvToolkit = new window.verovio.toolkit();
      vrvToolkit.loadData(xmlString);

      const tk = vrvToolkit;

      tk.setOptions({
        adjustPageHeight: true,
        // adjustPageWidth: false,
        // appXPathQuery: [],
        // barLineSeparation: 0.8,
        // barLineWidth: 0.3,
        // beamFrenchStyle: false,
        // beamMaxSlope: 10,
        // beamMixedPreserve: false,
        // beamMixedStemMin: 3.5,
        // bottomMarginArtic: 0.75,
        // bottomMarginHarm: 1,
        // bottomMarginHeader: 2,
        // bottomMarginOctave: 1,
        // bracketThickness: 1,
        // breaks: "auto",
        // breaksNoWidow: false,
        // breaksSmartSb: 0.66,
        // choiceXPathQuery: [],
        // condense: "auto",
        // condenseFirstPage: false,
        // condenseNotLastSystem: false,
        // condenseTempoPages: false,
        // dashedBarLineDashLength: 1.14,
        // dashedBarLineGapLength: 1.14,
        // defaultBottomMargin: 0.5,
        // defaultLeftMargin: 0,
        // defaultRightMargin: 0,
        // defaultTopMargin: 0.5,
        // dynamDist: 1,
        // dynamSingleGlyphs: false,
        // engravingDefaults: {},
        // evenNoteSpacing: false,
        // expand: "",
        // extenderLineMinSpace: 1.5,
        // fingeringScale: 0.75,
        // font: "Leipzig",
        // fontAddCustom: [],
        // fontFallback: "Leipzig",
        // fontLoadAll: false,
        footer: "none",
        // graceFactor: 0.75,
        // graceRhythmAlign: false,
        // graceRightAlign: false,
        // hairpinSize: 3,
        // hairpinThickness: 0.2,
        // handwrittenFont: [],
        // harmDist: 1,
        header: "none",
        // humType: false,
        // incip: false,
        // justificationBraceGroup: 1,
        // justificationBracketGroup: 1,
        // justificationMaxVertical: 0.3,
        // justificationStaff: 1,
        // justificationSystem: 1,
        // justifyVertically: false,
        // landscape: false,
        // ledgerLineExtension: 0.54,
        // ledgerLineThickness: 0.25,
        // leftMarginAccid: 1,
        // leftMarginBarLine: 0,
        // leftMarginBeatRpt: 2,
        // leftMarginChord: 1,
        // leftMarginClef: 1,
        // leftMarginKeySig: 1,
        // leftMarginLeftBarLine: 1,
        // leftMarginMRest: 0,
        // leftMarginMRpt2: 0,
        // leftMarginMensur: 1,
        // leftMarginMeterSig: 1,
        // leftMarginMultiRest: 0,
        // leftMarginMultiRpt: 0,
        // leftMarginNote: 1,
        // leftMarginRest: 1,
        // leftMarginRightBarLine: 1,
        // leftMarginTabDurSym: 1,
        // ligatureAsBracket: false,
        // loadSelectedMdivOnly: false,
        // lyricElision: "regular",
        // lyricLineThickness: 0.25,
        // lyricNoStartHyphen: false,
        // lyricSize: 4.5,
        // lyricTopMinMargin: 2,
        // lyricVerseCollapse: false,
        // lyricWordSpace: 1.2,
        // mdivAll: false,
        // mdivXPathQuery: "",
        // measureMinWidth: 15,
        // mensuralToMeasure: false,
        // midiNoCue: false,
        // midiTempoAdjustment: 1,
        // minLastJustification: 0.8,
        // mmOutput: false,
        // mnumInterval: 0,
        // moveScoreDefinitionToStaff: false,
        // multiRestStyle: "auto",
        // multiRestThickness: 2,
        // neumeAsNote: false,
        // noJustification: false,
        // octaveAlternativeSymbols: false,
        // octaveLineThickness: 0.2,
        // octaveNoSpanningParentheses: false,
        // openControlEvents: false,
        // outputFormatRaw: false,
        // outputIndent: 3,
        // outputIndentTab: false,
        // outputSmuflXmlEntities: false,
        // pageHeight: 2970,
        // pageMarginBottom: 50,
        // pageMarginLeft: 50,
        // pageMarginRight: 50,
        // pageMarginTop: 50,
        // pageWidth: 2100,
        // pedalLineThickness: 0.2,
        // pedalStyle: "auto",
        // preserveAnalyticalMarkup: false,
        // removeIds: false,
        // repeatBarLineDotSeparation: 0.36,
        // repeatEndingLineThickness: 0.15,
        // rightMarginAccid: 0.5,
        // rightMarginBarLine: 0,
        // rightMarginBeatRpt: 0,
        // rightMarginChord: 0,
        // rightMarginClef: 1,
        // rightMarginKeySig: 1,
        // rightMarginLeftBarLine: 1,
        // rightMarginMRest: 0,
        // rightMarginMRpt2: 0,
        // rightMarginMensur: 1,
        // rightMarginMeterSig: 1,
        // rightMarginMultiRest: 0,
        // rightMarginMultiRpt: 0,
        // rightMarginNote: 0,
        // rightMarginRest: 0,
        // rightMarginRightBarLine: 0,
        // rightMarginTabDurSym: 0,
        // scale: 100,
        // scaleToPageSize: false,
        // setLocale: false,
        // showRuntime: false,
        // shrinkToFit: false,
        // slurCurveFactor: 1,
        // slurEndpointFlexibility: 0,
        // slurEndpointThickness: 0.1,
        // slurMargin: 1,
        // slurMaxSlope: 60,
        // slurMidpointThickness: 0.6,
        // slurSymmetry: 0,
        // smuflTextFont: "embedded",
        // spacingBraceGroup: 12,
        // spacingBracketGroup: 12,
        // spacingDurDetection: false,
        // spacingLinear: 0.25,
        // spacingNonLinear: 0.6,
        // spacingStaff: 12,
        // spacingSystem: 4,
        // staccatoCenter: false,
        // staffLineWidth: 0.15,
        // stemWidth: 0.2,
        // subBracketThickness: 0.2,
        // substXPathQuery: [],
        // svgAdditionalAttribute: [],
        // svgBoundingBoxes: false,
        // svgCss: "",
        // svgFormatRaw: false,
        // svgHtml5: false,
        // svgRemoveXlink: false,
        // svgViewBox: false,
        // systemDivider: "auto",
        // systemMaxPerPage: 0,
        // textEnclosureThickness: 0.2,
        // thickBarlineThickness: 1,
        // tieEndpointThickness: 0.1,
        // tieMidpointThickness: 0.5,
        // tieMinLength: 2,
        // topMarginArtic: 0.75,
        // topMarginHarm: 1,
        // topMarginPgFooter: 2,
        // transpose: "",
        // transposeMdiv: {},
        // transposeSelectedOnly: false,
        // transposeToSoundingPitch: false,
        // tupletAngledOnBeams: false,
        // tupletBracketThickness: 0.2,
        // tupletNumHead: false,
        // unit: 9,
        // useBraceGlyph: false,
        // useFacsimile: false,
        // usePgFooterForAll: false,
        // usePgHeaderForAll: false,
        // xmlIdChecksum: false,
        // xmlIdSeed: 0,
      });

      const svg = vrvToolkit.renderToSVG(1); // Render the first page as SVG
      // console.log({ svg });

      setVerovioSVG(svg);
      setVerovioBlobUrl(convertSvgStringToBlobUrl(svg));
    });

    // save pdf
    // await m
    //   .savePdf()
    //   .then((r) => {
    //     const blob = new Blob([r], { type: "application/octet-stream" });
    //     const url = window.URL.createObjectURL(blob);
    //     const a = document.createElement("a");
    //     a.href = url;
    //     a.download = "test.pdf";
    //     document.body.appendChild(a);
    //     a.click();
    //   })
    //   .catch(console.warn);

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

    setScoreSvgs(si);
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

  const onClickLoad = async () => {
    // load(import.meta.env.BASE_URL + "test.mscz");
    try {
      await load(document.getElementById("fileUrl").value.trim());
    } catch (error) {
      alert(error);
    }
  };

  const onClickTogglePlay = () => {
    switch (state) {
      case "stopped":
        play();
        break;

      case "playing":
        stop();
        break;
    }
  };

  useEffect(() => {
    // const file = document.location.search.replace("?file=", "");
    document.getElementById("load-button")?.click();
  }, []);

  return (
    <div style={{ textAlign: "left" }}>
      <label>
        File Url:{" "}
        <textarea
          id="fileUrl"
          defaultValue="https://cadern.in/collection/axés/a luz de tiêta/carnaval bh 2024 - a luz de tiêta/carnaval bh 2024 - a luz de tiêta.mscz"
          defaultValue="https://cadern.in/collection/forrós/anunciação/carnaval bh 2024 - anunciação/carnaval bh 2024 - anunciação.mscz"
          defaultValue="https://cadern.in/collection/funks/se tá solteira/carnaval bh 2024 - se tá solteira/carnaval bh 2024 - se tá solteira.mscz"
          style={{ width: "100%", height: "100px" }}
        />
      </label>
      <button
        id="load-button"
        disabled={state == "loading"}
        onClick={onClickLoad}
      >
        {state === "loading" ? "Loading..." : "Load"}
      </button>
      {verovioBlobUrl && (
        <>
          <button onClick={onClickTogglePlay}>
            {state === "playing" ? "Stop" : "Play"}
          </button>
          <button
            onClick={() => {
              createSongBook(mock);
            }}
          >
            PDF
          </button>
        </>
      )}
      {state == "playing" ? (
        <div>Playback time: {playbackTime.toFixed(2)} s</div>
      ) : null}
      {currentElement != null ? <JSONTree data={currentElement} /> : null}
      <style>{`
        svg { width: 100%; height: 100%; }
        .StaffLines { stroke: #aaa; }
        .StaffText { fill: red; }
      `}</style>
      {/* <div id={`verovioSVG`} dangerouslySetInnerHTML={{ __html: verovioSVG }} /> */}
      <img id={`verovio`} src={verovioBlobUrl} style={{ maxWidth: "100%" }} />
      {/* {scoreSvgs?.map((svg, i) => (
        <>
          <div
            key={`scoreSvg-${i}`}
            id={`scoreSvg-${i}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </>
      ))} */}
      {/* {scoreImgUrls?.map((url, i) => (
        <img
          key={`scoreImg-${i}`}
          id={`scoreImg-${i}`}
          src={url}
          alt={`Page ${i}`}
          style={{ maxWidth: "100%" }}
        />
      ))} */}
      {meta != null ? <JSONTree data={meta} /> : null}
    </div>
  );
}

export default App;

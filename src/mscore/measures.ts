import type { Positions, PositionElement } from "webmscore/schemas";
import rbTree from "functional-red-black-tree";

/**
 * The Measure Time/Position Util
 */
export class Measures {
  private timeElTree: rbTree.Tree<number, number>;
  private elTimeTree: rbTree.Tree<number, number>;

  constructor(private mpos: Positions) {
    // build the red-black tree that indexes time positions to measure elements
    let timeElTree = rbTree<number, number>();
    // and the red-black tree that indexes measure element id to its first time occurrence in any repeat
    let elTimeTree = rbTree<number, number>();
    mpos.events.forEach((el) => {
      timeElTree = timeElTree.insert(el.position, el.elid);
      elTimeTree = elTimeTree.insert(el.elid, el.position);
    });
    this.timeElTree = timeElTree;
    this.elTimeTree = elTimeTree;
  }

  get elements(): MeasureEl[] {
    return this.mpos.elements;
  }

  /**
   * The width of the sheet image in px
   */
  get imgWidth(): number {
    return this.mpos.pageSize.width;
  }

  /**
   * The height of the sheet image in px
   */
  get imgHeight(): number {
    return this.mpos.pageSize.height;
  }

  /**
   * The aspect ratio (`width / height`) of the sheet image
   */
  get imgAspectRatio(): number {
    return this.imgWidth / this.imgHeight;
  }

  at(elid: number): MeasureEl {
    return this.elements[elid];
  }

  /**
   * Find the first element that its time position <= the given playback time
   */
  getElByTime(ms: number): MeasureEl | null {
    const elid = this.timeElTree.le(ms).value;
    return elid ? this.at(elid) : null;
  }

  getTimeByEl(el: MeasureEl): number | null {
    const elid = el.id;
    const ms = this.elTimeTree.get(elid); // The value of the first node associated to the key
    return ms ?? null;
  }
}

export type MeasureEl = PositionElement;

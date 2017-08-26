import { MathUtil } from 'app/scripts/common';
import * as $ from 'jquery';
import * as paper from 'paper';

import { AbstractTool } from './AbstractTool';
import {
  DetailSelectionGesture,
  Gesture,
  HoverGesture,
  RotateGesture,
  ScaleGesture,
  SelectionBoxGesture,
  SelectionGesture,
} from './gesture';
import { Guides, Items, Selections } from './util';

enum Mode {
  None,
  Scale,
  Rotate,
  MoveShapes,
  CloneShapes,
  SelectionBox,
}

/**
 * A simple selection tool for moving, scaling, rotating, and selecting shapes.
 * TODO: figure out how to deal with right mouse clicks
 */
export class SelectionTool extends AbstractTool {
  private _currentGesture: Gesture = new HoverGesture();
  private _detailSelectedPath: paper.Path;
  private hitResult: paper.HitResult;

  private get currentGesture() {
    return this._currentGesture;
  }

  private set currentGesture(gesture: Gesture) {
    this._currentGesture = gesture;
  }

  private get detailSelectedItem() {
    return this._detailSelectedPath;
  }

  private set detailSelectedItem(path: paper.Path) {
    this._detailSelectedPath = path;
  }

  // @Override
  protected onMouseDown(event: paper.ToolEvent) {
    // If a detail selected item is set, then we are in detail selection mode.
    if (this.detailSelectedItem) {
      this.hitResult = this.detailSelectedItem.hitTest(event.point, {
        segments: true,
        stroke: true,
        curves: true,
        handles: true,
        fill: true,
        tolerance: 3 / paper.view.zoom,
      });
      if (this.hitResult) {
        // Process the detail selection gesture for the hit item.
        this.currentGesture = new DetailSelectionGesture(this.detailSelectedItem);
      } else {
        // TODO: Only enter selection box mode when we are certain that a drag
        // has occurred. If a drag does not occur, then we should interpret the
        // gesture as a click. If a click occurs and shift is not pressed, then
        // we should exit detail selection mode.

        // If there is no hit item and we are in detail selection mode, then
        // enter selection box mode for the detail selected item so we can
        // batch select its individual properties.
        this.currentGesture = new SelectionBoxGesture(true);
      }
    } else {
      this.hitResult = paper.project.hitTest(event.point, {
        segments: true,
        stroke: true,
        curves: true,
        fill: true,
        tolerance: 8 / paper.view.zoom,
      });
      if (this.hitResult) {
        const hitItem = this.hitResult.item;
        if (Guides.isScaleHandle(hitItem)) {
          // If the hit item is a scale handle, then perform a scale gesture.
          this.currentGesture = new ScaleGesture();
        } else if (Guides.isRotationHandle(hitItem)) {
          // If the hit item is a rotate handle, then perform a rotate gesture.
          this.currentGesture = new RotateGesture();
        } else if (this.isDoubleClickEvent()) {
          // TODO: It should only be possible to enter detail selection mode
          // for an editable item (i.e. a path, but not a group). Double clicking
          // on a non-selected and editable item that is contained inside a selected
          // parent layer should result in the editable item being selected (it is
          // actually a tiny bit more complicated than that but you get the idea).

          // TODO: possible to double click on a non-Path object? (missing types below!)

          // If a double click event occurs on top of a hit item, then enter
          // detail selection mode.
          this.detailSelectedItem = hitItem as paper.Path;
          this.currentGesture = new class extends Gesture {
            onMouseDown(e: paper.ToolEvent, { item }: paper.HitResult) {
              Selections.deselectAll();
              item.fullySelected = true;
            }
          }();
        } else if (
          event.modifiers.shift &&
          hitItem.selected &&
          Selections.getSelectedItems().length > 1
        ) {
          // TODO: After the item is deselected, it should still be possible
          // to drag/clone any other selected items in subsequent mouse events

          // If the hit item is selected, shift is pressed, and there is at least
          // one other selected item, then deselect the hit item.
          this.currentGesture = new class extends Gesture {
            onMouseDown(e: paper.ToolEvent, { item }: paper.HitResult) {
              Selections.setSelection(item, false);
            }
          }();
        } else {
          // TODO: The actual behavior in Sketch is a bit more complicated.
          // For example, (1) a cloned item will not be generated until the next
          // onMouseDrag event, (2) on the next onMouseDrag event, the
          // cloned item should be selected and the currently selected item should
          // be deselected, (3) the user can cancel a clone operation mid-drag by
          // pressing/unpressing alt (even if alt wasn't initially pressed in
          // onMouseDown).

          // At this point we know that either (1) the hit item is not selected
          // or (2) the hit item is selected, shift is not being pressed, and
          // there is only one selected item. In both cases the hit item should
          // end up being selected. If alt is being pressed, then we should
          // clone the item as well.
          this.currentGesture = new SelectionGesture(event.modifiers.alt);
        }
      } else {
        // If there is no hit item, then enter selection box mode.
        this.currentGesture = new SelectionBoxGesture(false);
      }
    }
    this.currentGesture.onMouseDown(event, this.hitResult);
  }

  // @Override
  protected onMouseDrag(event: paper.ToolEvent) {
    this.currentGesture.onMouseDrag(event);
  }

  // @Override
  protected onMouseMove(event: paper.ToolEvent) {
    this.currentGesture.onMouseMove(event);
  }

  // @Override
  protected onMouseUp(event: paper.ToolEvent) {
    this.currentGesture.onMouseUp(event);
    if (this.detailSelectedItem && !this.hitResult) {
      // TODO: only exit detail selection mode if the selection box
      // gesture resulted in no items being selected
      this.detailSelectedItem = undefined;
    }
    this.currentGesture = new HoverGesture();
  }
}

// TODO: make use of this function!
// var preProcessSelection = function() {
//   // when switching to the select tool while having a child object of a
//   // compound path selected, deselect the child and select the compound path
//   // instead. (otherwise the compound path breaks because of scale-grouping)
//   var items = pg.selection.getSelectedItems();
//   jQuery.each(items, function(index, item) {
//     if(pg.compoundPath.isCompoundPathChild(item)) {
//       var cp = pg.compoundPath.getItemsCompoundPath(item);
//       pg.selection.setItemSelection(item, false);
//       pg.selection.setItemSelection(cp, true);
//     }
//   });
//   setSelectionBounds();
// };
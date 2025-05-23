import { Component, OnInit, Input, Output, ChangeDetectionStrategy, EventEmitter } from '@angular/core'
import { UntypedFormGroup } from '@angular/forms'
import { InterpolationType } from "../../_models/_graph/interpolation-type"
import { ButtonsState } from 'src/app/_models/_graph/buttons-state'

@Component({
  selector: 'subgraph',
  templateUrl: './subgraph.component.html',
  styleUrls: ['./subgraph.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class SubgraphComponent implements OnInit {
  @Input() subgraphForm: UntypedFormGroup
  @Input() index: number
  @Output() deleteSubgraph: EventEmitter<number> = new EventEmitter()
  @Output() toggleAccordian: EventEmitter<string> = new EventEmitter()
  @Output() interpolationTypeChanged: EventEmitter<string> = new EventEmitter()
  @Output() togglePointButton: EventEmitter<ButtonsState> = new EventEmitter()

  interpolationType = InterpolationType;

  isOpened = false;

  constructor() { }

  ngOnInit() {
    this.subgraphForm.controls['id'].setValue(this.index);
  }

  delete() {
    this.deleteSubgraph.emit(this.index);
  }

  onChange(newValue: string) {
    this.interpolationTypeChanged.emit(newValue);
  }
}
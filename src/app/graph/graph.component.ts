import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core'
import { UntypedFormGroup, UntypedFormArray } from '@angular/forms'
import { GraphFormService } from '../_services/_graph/graph-form.service'
import { forkJoin, Observable, of, Subscription, throwError } from 'rxjs'
import { switchMap } from 'rxjs/operators';
import * as FunctionCurveEditor from "../function-curve-editor/Index";
import { ButtonsState } from '../_models/_graph/buttons-state';
import { Graph } from '../_models/_graph';
import { InterpolationType } from '../_models/_graph/interpolation-type';
import { WidgetState } from '../_models/_widget/widget-state';
import { AxisPointChange, Point } from '../_models/_graph/point';
import { GraphMathService } from '../_services/_graph/graph-math.service';
import { JsonFileService } from '../_services/_file/json-file.service';
import { HttpService } from '../_services/_http/http.service';
import { CalculatedGraphModel } from '../_models/_graph/calculated-graph-model';
import { ActivatedRoute } from '@angular/router';
import { ConfigurationService } from '../_services/_config/configuration.service';
import { NgbAccordionDirective } from '@ng-bootstrap/ng-bootstrap';
import { CommentModel } from '../_models/_graph/comments-model';

@Component({
  selector: 'graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.css'],
  standalone: false
})
export class GraphComponent implements OnInit, OnDestroy {
  graphForm: UntypedFormGroup;
  graphFormSub: Subscription;
  subgraphs: UntypedFormArray;
  xAxisPoints: UntypedFormArray;
  yAxisPoints: UntypedFormArray;

  widget: FunctionCurveEditor.Widget;

  imageFileToUpload: File = null;
  jsonFileToUpload: File = null;
  commentsFileToUpload: File = null;

  base64ImageString: string;
  comments: CommentModel[];

  imageFileUrl = "";
  graphFileUrl = "";
  commentsFileUrl = "";

  error = '';

  showAllSubgraphs: boolean = false;
  showComments: boolean = true;
  axisButtonActive: boolean = false;

  currentActivePanelId: number = undefined;

  pointButtonsState: ButtonsState = {
    origin: false,
    xAxis: false,
    yAxis: false
  };

  nSubplots: number = 1;
  curSubplot: number = 0;
  subPlot = {
    prev: false,
    next: false
  };

  @ViewChild('acc') accordion: NgbAccordionDirective;

  constructor(private graphFormService: GraphFormService,
    private graphMathService: GraphMathService,
    private jsonFileService: JsonFileService,
    private httpService: HttpService,
    private route: ActivatedRoute,
    private configuration: ConfigurationService) { }

  ngOnInit() {
    this.graphFormSub = this.graphFormService.graphForm$
      .subscribe(graph => {
        this.graphForm = graph
        this.subgraphs = this.graphForm.get('subgraphs') as UntypedFormArray
        this.xAxisPoints = this.graphForm.get('xAxisPoints') as UntypedFormArray
        this.yAxisPoints = this.graphForm.get('yAxisPoints') as UntypedFormArray
      });

    const initialEditorState = <FunctionCurveEditor.EditorState>{
      knots: [],
      xMin: 0,
      xMax: 1000,
      yMin: 0,
      yMax: 700,
      extendedDomain: false,
      gridEnabled: false,
      interpolationMethod: "none"
    };

    this.graphFormService.addSubgraph()
    this.graphFormService.addXAxisPoint()
    this.graphFormService.addYAxisPoint()

    this.startup(initialEditorState);

    this.route.queryParams.subscribe(params => {
      this.nSubplots = params['n_subplots'];
      this.imageFileUrl = params['png'];
      this.graphFileUrl = params['json'];
      this.commentsFileUrl = params['comments'];
      this.loadFiles().subscribe({
        next: () => {
          try {
            this.handleLoadedFiles();
            this.onAxisPointsChanges();
          } catch (error) {
            this.error = error.message;
          }
        },
        error: error => this.error = error.message
      });
    });

    setTimeout(() => {
      this.curSubplot = this.getCurrentSubplot();

      if (this.nSubplots <= 1) return;

      if (this.curSubplot >= (this.nSubplots - 1)) {
        this.subPlot.prev = true;
        this.subPlot.next = false;

      } else if (this.curSubplot < 1) {
        this.subPlot.prev = false;
        this.subPlot.next = true;

      } else {
        this.subPlot.prev = true;
        this.subPlot.next = true;
      }

      this.trySetEditorStateForComments();
    }, 300);
  }

  private onAxisPointsChanges(): void {
    this.graphForm.get('originPoint').valueChanges.subscribe(() => {
      this.trySetEditorStateForComments();
    });
    this.graphForm.get('xAxisPoints').valueChanges.subscribe(() => {
      this.trySetEditorStateForComments();
    });
    this.graphForm.get('yAxisPoints').valueChanges.subscribe(() => {
      this.trySetEditorStateForComments();
    });
  }

  ngOnDestroy() {
    this.graphFormSub.unsubscribe()
  }

  subPlotPrev() {
    this.curSubplot--;
    window.location.href = this.configuration.getValue('prevNextUrl') + 'subplot=' + this.curSubplot + '&entry=' + this.getEntry();
  }

  subPlotNext() {
    this.curSubplot++;
    window.location.href = this.configuration.getValue('prevNextUrl') + 'subplot=' + this.curSubplot + '&entry=' + this.getEntry();
  }

  addGraph() {
    if (!this.graphFileUrl) return alert('Please finish the current graph');
    window.location.href = this.configuration.getValue('addUrl') + 'append=1&subplot=' + this.nSubplots + '&entry=' + this.getEntry();
  }

  deleteGraph() {
    if (!this.graphFileUrl || (!this.subPlot.prev && !this.subPlot.next)) return alert('Cannot delete current graph');
    if (!confirm('Are you REALLY sure to DELETE this markup? Expect comments shift.')) return;

    const url = this.configuration.getValue('postDeleteGraphUrl'),
      entry = this.getEntry();

    if (!url || !entry) {
      this.error = 'Empty remote endpoint url.';
      return;
    }

    this.httpService.postDeleteGraph(url, entry, this.curSubplot)
      .subscribe({
        next: (response: any) => {
          const newSubplot = this.curSubplot === 0 ? this.curSubplot : this.curSubplot - 1;
          window.location.href = this.configuration.getValue('prevNextUrl') + 'subplot=' + newSubplot + '&entry=' + entry;
        },
        error: error => this.error = error.message,
      });
  }

  addSubgraph() {
    this.graphFormService.addSubgraph();

    const length = this.graphFormService.getSubgraphsLength();

    if (length == 1) {
      this.setInitialWidgetState();
    }
  }

  addXAxisPoint() {
    this.graphFormService.addXAxisPoint();
  }

  addYAxisPoint() {
    this.graphFormService.addYAxisPoint();
  }

  deleteSubgraph(index: number) {
    this.graphFormService.deleteSubgraph(index);

    const length = this.graphFormService.getSubgraphsLength();

    if (this.currentActivePanelId <= length) {
      this.setInitialWidgetState();
    }
  }

  deleteXAxisPoint(index: number) {
    this.graphFormService.deleteXAxisPoint(index);

    const eState = this.widget.getEditorState();
    eState.xAxisPoints.splice(index, 1);
    eState.axisPointIndex = 0;
    this.widget.setEditorState(eState);
  }

  deleteYAxisPoint(index: number) {
    this.graphFormService.deleteYAxisPoint(index);

    const eState = this.widget.getEditorState();
    eState.yAxisPoints.splice(index, 1);
    eState.axisPointIndex = 0;
    this.widget.setEditorState(eState);
  }

  private loadFiles(): Observable<(string | ArrayBuffer)[]> {
    const tasks: Observable<string | ArrayBuffer>[] = [];

    if (this.imageFileUrl) {
      tasks.push(this.loadImageFileFromUrl(this.imageFileUrl));
    }
    if (this.graphFileUrl) {
      tasks.push(this.loadGraphFileFromUrl(this.graphFileUrl));
    }
    if (this.commentsFileUrl) {
      tasks.push(this.loadCommentsFileFromUrl(this.commentsFileUrl));
    }

    return tasks.length > 0 ? forkJoin(tasks) : of([]);
  }

  private loadImageFileFromUrl(url: string): Observable<string | ArrayBuffer> {
    return this.httpService.getFile(url).pipe(
      switchMap((blob: Blob) => {
        const expectedType = 'image/png';
        if (blob.type !== expectedType) {
          return throwError(new Error('Wrong file type')) as Observable<string | ArrayBuffer>;
        }
        this.imageFileToUpload = new File(
          [blob],
          url.split('/').pop() || 'image.png',
          { type: expectedType }
        );

        return new Observable<string | ArrayBuffer>(observer => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (result !== null) {
              try {
                this.handleLoadedImageFile(result);
                observer.next(result);
                observer.complete();
              } catch (error) {
                observer.error(error);
              }
            } else {
              observer.error(new Error(`Unable to read ${this.imageFileToUpload.name} file.`));
            }
          };
          reader.onerror = error => observer.error(error);
          reader.readAsArrayBuffer(this.imageFileToUpload);
        });
      })
    );
  }

  private loadGraphFileFromUrl(url: string): Observable<string | ArrayBuffer> {
    return this.httpService.getFile(url).pipe(
      switchMap((blob: Blob) => {
        const expectedType = 'application/json';

        if (blob.type !== expectedType) {
          return throwError(new Error('Wrong file type')) as Observable<string | ArrayBuffer>;
        }

        this.jsonFileToUpload = new File(
          [blob],
          url.split('/').pop() || 'file.json',
          { type: expectedType }
        );

        return new Observable<string | ArrayBuffer>(observer => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (result !== null) {
              try {
                this.handleLoadedGraphFile(result);
                observer.next(result);
                observer.complete();
              } catch (error) {
                observer.error(error);
              }
            } else {
              observer.error(new Error(`Unable to read ${this.jsonFileToUpload.name} file.`));
            }
          };
          reader.onerror = (error) => observer.error(error);
          reader.readAsText(this.jsonFileToUpload);
        });
      })
    );
  }

  private loadCommentsFileFromUrl(url: string): Observable<string | ArrayBuffer> {
    return this.httpService.getFile(url).pipe(
      switchMap((blob: Blob) => {
        const expectedType = 'application/json';
        if (blob.type !== expectedType) {
          return throwError(new Error('Wrong file type')) as Observable<string | ArrayBuffer>;
        }
        this.commentsFileToUpload = new File(
          [blob],
          url.split('/').pop() || 'comments.json',
          { type: expectedType }
        );
        return new Observable<string | ArrayBuffer>((observer) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (result !== null) {
              try {
                this.handleLoadedCommentsFile(result);
                observer.next(result);
                observer.complete();
              } catch (error) {
                observer.error(error);
              }
            } else {
              observer.error(new Error(`Unable to read ${this.commentsFileToUpload.name} file.`));
            }
          };
          reader.onerror = (error) => observer.error(error);
          reader.readAsText(this.commentsFileToUpload);
        });
      })
    );
  }

  private handleLoadedImageFile(readerData: string | ArrayBuffer) {
    if (typeof readerData === 'string') {
      this.base64ImageString = btoa(readerData);
    } else {
      this.base64ImageString = this.arrayBufferToBase64(readerData);
    }
  }

  private handleLoadedGraphFile(readerData: string | ArrayBuffer) {
    let jsonData: string;

    if (typeof readerData === 'string') {
      jsonData = readerData;
    } else {
      jsonData = new TextDecoder('utf-8').decode(readerData);
    }

    const calculatedGraph = this.jsonFileService.loadGraphDataFromJsonString(jsonData);

    if (calculatedGraph == undefined
      || calculatedGraph.subgraphs == undefined
      || calculatedGraph.originPoint == undefined
      || calculatedGraph.xAxisPoints == undefined
      || calculatedGraph.yAxisPoints == undefined) {
      throw new Error('Invalid graph json structure.');
    }

    this.graphFormService.setGraphData(calculatedGraph);
  }

  private handleLoadedCommentsFile(readerData: string | ArrayBuffer) {
    let jsonData: string;

    if (typeof readerData === 'string') {
      jsonData = readerData;
    } else {
      jsonData = new TextDecoder('utf-8').decode(readerData);
    }

    this.comments = this.jsonFileService.loadCommentsDataFromJsonString(jsonData);

    if (this.comments == undefined
      || !this.comments.length) {
      throw new Error('Invalid comments json structure.');
    }
  }

  private handleLoadedFiles() {
    if (this.base64ImageString) {
      this.widget.setWidgetContextImage(this.base64ImageString, this.imageFileToUpload.type);
    }

    this.setEditorStateForGraph();
  }

  private setEditorStateForGraph(): void {
    const eState = this.widget.getEditorState();
    const graph = this.graphForm.value as Graph;

    eState.originPoint = { x: graph.originPoint.xCoordinate, y: graph.originPoint.yCoordinate };

    eState.xAxisPoints = [];
    for (let i = 0; i < graph.xAxisPoints.length; i++) {
      eState.xAxisPoints.push({ x: graph.xAxisPoints[i].xCoordinate, y: graph.xAxisPoints[i].yCoordinate });
    }

    eState.yAxisPoints = [];
    for (let i = 0; i < graph.yAxisPoints.length; i++) {
      eState.yAxisPoints.push({ x: graph.yAxisPoints[i].xCoordinate, y: graph.yAxisPoints[i].yCoordinate });
    }

    if (graph.subgraphs.length == 0) {
      eState.knots = [];
      this.widget.setConnected(false);
    }
    else {
      this.currentActivePanelId = 0;
      eState.knots = graph.subgraphs[this.currentActivePanelId].knots;
      eState.interpolationMethod = graph.subgraphs[this.currentActivePanelId].interpolationType;
      this.widget.setConnected(true);
    }

    this.widget.setEditorState(eState);
  }

  private trySetEditorStateForComments(): void {
    setTimeout(() => {
      try {
        this.setEditorStateForComments();
      } catch (error) {
        this.error = error.message;
      }
    }, 0);
  }

  private setEditorStateForComments(): void {
    const eState = this.widget.getEditorState();
    const isValidOriginPoint = this.graphForm.get('originPoint').valid;
    const isValidXAxisPoints = this.graphForm.get('xAxisPoints').valid;
    const isValidYAxisPoints = this.graphForm.get('yAxisPoints').valid;
    const isValidGraphToShowComments = isValidOriginPoint && isValidXAxisPoints && isValidYAxisPoints;
    const graph = this.graphForm.value as Graph;

    eState.showComments = this.showComments;
    eState.comments = [];

    if (this.showComments
      && this.comments
      && !isValidGraphToShowComments
    ) {
      this.widget.setEditorState(eState);
      throw new Error('Cannot show comments due to invalid graph.');
    }

    if (this.comments && isValidGraphToShowComments) {
      this.comments.forEach(comment => {

        if (this.curSubplot !== comment.subplot) return;

        const canvasCoordinate = this.graphMathService.calculateOriginalCoordinate(
          {
            x: comment.coordinate.x,
            y: comment.coordinate.y,
          },
          graph.originPoint,
          graph.xAxisPoints,
          graph.yAxisPoints);

        eState.comments.push({
          coordinate: {
            x: canvasCoordinate.x,
            y: canvasCoordinate.y,
          },
          text: comment.text,
        });
      });
    }

    this.widget.setEditorState(eState);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  onShowAllSubgraphsToggle(event: any) {
    this.showAllSubgraphs = event.currentTarget.checked ? true : false;

    const eState = this.widget.getEditorState();
    const graphData = this.graphForm.value as Graph;
    eState.curvesState = this.graphFormService.getSubgraphsState(graphData.subgraphs);
    eState.showAllCurves = this.showAllSubgraphs;
    this.widget.setEditorState(eState);
  }

  onShowCommentsToggle(event: any) {
    this.showComments = event.currentTarget.checked ? true : false;

    this.trySetEditorStateForComments();
  }

  saveGraphLocally() {
    const result = this.getFixedCalculatedGraph();
    const fileName = (this.imageFileToUpload ? this.imageFileToUpload.name.split('.')[0] : 'result') + '.json';
    this.jsonFileService.saveJsonFromGraphData(result, fileName);
  }

  saveGraphRemotely() {
    const url = this.configuration.getValue('postGraphDataUrl');
    if (!url) {
      this.error = 'Empty remote endpoint url.';
      return;
    }
    const result = this.getFixedCalculatedGraph();
    this.httpService.postGraphData(url, result)
      .subscribe({
        next: (response: any) => {
          if (response.error) {
            this.error = response.error;
            //const entry = this.getEntry();
            //if (entry) localStorage.setItem(entry, JSON.stringify(result));
          }
          else if (response.redirect) {
            //const entry = this.getEntry();
            //if (entry) localStorage.removeItem(entry);
            window.location.href = response.redirect;
          }
          else {
            this.error = 'Invalid response from upload endpoint.';
          }
        },
        error: error => this.error = error.message,
      });
  }

  recutGraphRedirect() {
    const entry = this.getEntry();
    if (entry) window.location.href = this.configuration.getValue('redirectCutUrl') + entry;
  }

  cancelGraph() {
    window.location.href = this.configuration.getValue('cancelUrl');
  }

  private getEntry() {
    // extract current B-entry number from the active URL
    if (!this.imageFileUrl) return false;

    const entryUrl = this.imageFileUrl.split('entry').pop();
    if (entryUrl.indexOf('B') == -1) return false;

    return 'B' + entryUrl.split('B').pop();
  }

  private getCurrentSubplot() {
    // extract current sub-graph number from the active URL
    if (!this.graphFileUrl) return 0;

    let subplot = parseInt(this.graphFileUrl.split('subplot').pop().replace('=', ''));

    return subplot;
  }

  private getFixedCalculatedGraph(): CalculatedGraphModel {
    const graphData = this.graphForm.value as Graph;
    const calculatedGraph = this.graphMathService.calculateResultGraph(graphData);
    return calculatedGraph.toFixed(8);
  }

  toggleOrigin(event: MouseEvent) {
    if (this.axisButtonActive) {
      event.stopPropagation();
      return;
    }

    this.axisButtonActive = true;
    this.pointButtonsState.origin = true;

    this.togglePointButton();
  }

  toggleXAxisPointButton(event: MouseEvent, index: number) {
    if (this.axisButtonActive) {
      event.stopPropagation();
      return;
    }

    this.axisButtonActive = true;
    this.pointButtonsState.xAxis = true;

    const eState = this.widget.getEditorState();
    eState.axisButtonsState = this.pointButtonsState;
    eState.axisPointIndex = index;
    this.widget.setEditorState(eState);
  }

  toggleYAxisPointButton(event: MouseEvent, index: number) {
    if (this.axisButtonActive) {
      event.stopPropagation();
      return;
    }

    this.axisButtonActive = true;
    this.pointButtonsState.yAxis = true;

    const eState = this.widget.getEditorState();
    eState.axisButtonsState = this.pointButtonsState;
    eState.axisPointIndex = index;
    this.widget.setEditorState(eState);
  }

  togglePointButton() {
    const eState = this.widget.getEditorState();
    eState.axisButtonsState = this.pointButtonsState;
    this.widget.setEditorState(eState);
  }

  public toggleAccordion(itemId: number) {
    if (this.accordion.isExpanded(itemId.toString())) {
      this.currentActivePanelId = itemId;
      this.widget.setConnected(true);
    } else {
      this.currentActivePanelId = undefined;
      this.widget.setConnected(false);
    }

    this.setInitialWidgetState();
  }

  setInitialWidgetState() {
    const eState = this.widget.getEditorState();

    if (this.currentActivePanelId != undefined) {
      const widgetState = this.graphFormService.getSubgraphData(this.currentActivePanelId);
      eState.knots = widgetState.knots;
      eState.interpolationMethod = widgetState.interpolationType;
    }
    this.widget.setEditorState(eState);
  }

  interpolationTypeChanged(method: string) {
    const eState = this.widget.getEditorState();
    eState.interpolationMethod = <FunctionCurveEditor.InterpolationMethod>method;
    this.widget.setEditorState(eState);
  }

  public widgetChangeEventHandler() {
    const eState = this.widget.getEditorState();

    const widgetState = new WidgetState();
    widgetState.subgraphId = this.currentActivePanelId;
    widgetState.interpolationType = eState.interpolationMethod as InterpolationType;
    widgetState.knots = eState.knots;
    widgetState.coordinates = eState.coordinates;
    widgetState.originPoint = eState.originPoint as Point;
    widgetState.xAxisPoints = eState.xAxisPoints as Point[];
    widgetState.yAxisPoints = eState.yAxisPoints as Point[];
    widgetState.axisPointIndex = eState.axisPointIndex;

    this.graphFormService.setSubgraphData(widgetState);
  }

  public widgetAxisPointSetEventHandler(changedAxisPoint: AxisPointChange, index: number) {
    if (this.pointButtonsState.origin) {
      document.getElementById('btn_origin').classList.remove('active');
    }
    if (this.pointButtonsState.xAxis) {
      document.getElementById('btn_xAxis_' + index.toString()).classList.remove('active');
    }
    if (this.pointButtonsState.yAxis) {
      document.getElementById('btn_yAxis_' + index.toString()).classList.remove('active');
    }

    this.axisButtonActive = false;
    this.pointButtonsState.origin = false;
    this.pointButtonsState.xAxis = false;
    this.pointButtonsState.yAxis = false;

    this.togglePointButton();

    const eState = this.widget.getEditorState();
    const widgetState = new WidgetState();
    widgetState.originPoint = eState.originPoint as Point;
    widgetState.xAxisPoints = eState.xAxisPoints as Point[];
    widgetState.yAxisPoints = eState.yAxisPoints as Point[];
    widgetState.axisPointIndex = eState.axisPointIndex;
    widgetState.changedAxisPoint = changedAxisPoint;
    this.graphFormService.setAxisPointsData(widgetState);
  }

  private startup(initialEditorState: FunctionCurveEditor.EditorState) {
    const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("functionCurveEditor");
    this.widget = new FunctionCurveEditor.Widget(canvas, false);
    this.widget.setWidgetChangeEventHandler(() => { this.widgetChangeEventHandler() });
    this.widget.setWidgetAxisPointSetEventHandler((changedAxisPoint, index) => { this.widgetAxisPointSetEventHandler(changedAxisPoint as AxisPointChange, index) });
    this.widget.setEditorState(initialEditorState);
  }
}

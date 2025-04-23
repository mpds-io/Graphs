import { Injectable } from '@angular/core'
import { saveAs } from 'file-saver';
import { CalculatedGraphModel } from 'src/app/_models/_graph/calculated-graph-model';
import { CommentModel } from 'src/app/_models/_graph/comments-model';

@Injectable()
export class JsonFileService {
  
  constructor() { }
  
  public saveJsonFromGraphData(data: CalculatedGraphModel, fileName: string) {
    const jsonString = JSON.stringify(data);
    var blob = new Blob([jsonString], {type: "application/json;charset=utf-8"})
    saveAs(blob, fileName);
  }

  public loadGraphDataFromJsonString(data: string) : CalculatedGraphModel {
    const graphObjectFromJson = JSON.parse(data);
    return graphObjectFromJson as CalculatedGraphModel;
  }

  public loadCommentsDataFromJsonString(data: string) : CommentModel[] {
    const commentsObjectFromJson = JSON.parse(data);
    return commentsObjectFromJson as CommentModel[];
  }
}
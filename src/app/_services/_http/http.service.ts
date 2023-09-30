import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http';
import { CalculatedGraphModel } from 'src/app/_models/_graph/calculated-graph-model';

@Injectable()
export class HttpService {

  constructor(private http: HttpClient) { }

  public getFile(url: string) {
    return this.http.get(url, {responseType: 'blob'});
  }

  public postGraphData(url: string, data: CalculatedGraphModel) {
    return this.http.post(url, data);
  }

  public postDeleteGraph(url: string, entry: string, subplot: number) {
    return this.http.post(url, new HttpParams()
      .append("entry", entry)
      .append("subplot", subplot)
    );
  }
}

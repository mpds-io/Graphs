import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http';
import { CalculatedGraphModel } from 'src/app/_models/_graph/calculated-graph-model';
import { Observable } from 'rxjs';

@Injectable()
export class HttpService {

  constructor(private http: HttpClient) { }

  public getFile(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }

  public postGraphData(url: string, data: CalculatedGraphModel): Observable<any> {
    return this.http.post(url, data);
  }

  public postDeleteGraph(url: string, entry: string, subplot: number): Observable<any> {
    return this.http.post(url, new HttpParams()
      .append("entry", entry)
      .append("subplot", subplot)
    );
  }
}

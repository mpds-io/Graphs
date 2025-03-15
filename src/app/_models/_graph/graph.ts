import { AxisPoint } from './point';
import { Subgraph } from './subgraph';

export class Graph{
    graphName: string;
    xAxisName: string;
    yAxisName: string;
    originPoint: AxisPoint;
    subgraphs: Subgraph[];
    xAxisPoints: AxisPoint[];  
    yAxisPoints: AxisPoint[];  
}
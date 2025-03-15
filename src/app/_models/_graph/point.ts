export interface Point {
    x: number;
    y: number;
}

export enum AxisPointChange { 
    None   = 0,
    Origin = 1 << 0, // 1
    XAxis  = 1 << 1, // 2
    YAxis  = 1 << 2, // 4
  }

export interface AxisPoint {
    xValue: number;
    yValue: number;
    xCoordinate: number;
    yCoordinate: number;
    isLogScale: boolean;
    logBase: number;
}
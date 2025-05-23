import { Injectable } from '@angular/core'
import { Subgraph, Graph } from '../../_models/_graph'
import { Point, AxisPoint } from 'src/app/_models/_graph/point'
import { CalculatedGraphModel } from 'src/app/_models/_graph/calculated-graph-model'

@Injectable()
export class GraphMathService {
    constructor() { }

    public calculateResultGraph(data: Graph): CalculatedGraphModel {
        const calculatedGraph = new CalculatedGraphModel();

        calculatedGraph.subgraphs = Array<Subgraph>();
        calculatedGraph.graphName = data.graphName;
        calculatedGraph.xAxisName = data.xAxisName;
        calculatedGraph.yAxisName = data.yAxisName;
        calculatedGraph.originPoint = data.originPoint;
        calculatedGraph.xAxisPoints = this.getSortedXAxisPoints(data);
        calculatedGraph.yAxisPoints = this.getSortedYAxisPoints(data);

        for (let i = 0; i < data.subgraphs.length; i++) {
            const subgraph = new Subgraph();

            subgraph.id = data.subgraphs[i].id;
            subgraph.interpolationType = data.subgraphs[i].interpolationType;
            subgraph.name = data.subgraphs[i].name;
            subgraph.knots = data.subgraphs[i].knots;
            subgraph.tempCoordinates = data.subgraphs[i].coordinates;

            if (data.subgraphs[i].coordinates) {
                subgraph.coordinates = this.calculateResultCoordinates(
                    data.subgraphs[i].coordinates,
                    data.originPoint,
                    calculatedGraph.xAxisPoints,
                    calculatedGraph.yAxisPoints);
            }

            calculatedGraph.subgraphs.push(subgraph);
        }

        return calculatedGraph;
    }

    public calculateOriginalCoordinate(
        coordinate: Point,
        originPoint: AxisPoint,
        xAxisPoints: AxisPoint[],
        yAxisPoints: AxisPoint[]
    ): Point {
        const sortedXAxisPoints = this.sortAxisPoints(xAxisPoints, point => point.xValue);
        const sortedYAxisPoints = this.sortAxisPoints(yAxisPoints, point => point.yValue);

        const xAxisIndex = this.currentAxisIndex(sortedXAxisPoints, coordinate.x, point => point.xValue);
        const yAxisIndex = this.currentAxisIndex(sortedYAxisPoints, coordinate.y, point => point.yValue);

        const { xAngle, yAngle } = this.calculateRotationAngles(originPoint, sortedXAxisPoints[xAxisIndex], sortedYAxisPoints[yAxisIndex]);

        const rotatedSortedXAxisPoints = this.rotateAxisPoints(sortedXAxisPoints, originPoint, xAngle, yAngle);
        const rotatedSortedYAxisPoints = this.rotateAxisPoints(sortedYAxisPoints, originPoint, xAngle, yAngle);

        let x = 0;
        let y = 0;

        if (xAxisIndex == 0) {
            if (rotatedSortedXAxisPoints[xAxisIndex].isLogScale
                && rotatedSortedXAxisPoints[xAxisIndex].logBase) {
                x = this.reverseCalculateXCoordinateOnLogScale(
                    coordinate.x,
                    originPoint,
                    rotatedSortedXAxisPoints[xAxisIndex]);
            }
            else {
                x = this.reverseCalculateXCoordinateOnLinearScale(
                    coordinate.x,
                    originPoint,
                    rotatedSortedXAxisPoints[xAxisIndex]);
            }
        }
        else {
            if (rotatedSortedXAxisPoints[xAxisIndex].isLogScale
                && rotatedSortedXAxisPoints[xAxisIndex].logBase) {
                x = this.reverseCalculateXCoordinateOnLogScale(
                    coordinate.x,
                    rotatedSortedXAxisPoints[xAxisIndex - 1],
                    rotatedSortedXAxisPoints[xAxisIndex]);
            }
            else {
                x = this.reverseCalculateXCoordinateOnLinearScale(
                    coordinate.x,
                    rotatedSortedXAxisPoints[xAxisIndex - 1],
                    rotatedSortedXAxisPoints[xAxisIndex]);
            }
        }

        if (yAxisIndex == 0) {
            if (rotatedSortedYAxisPoints[yAxisIndex].isLogScale
                && rotatedSortedYAxisPoints[yAxisIndex].logBase) {
                y = this.reverseCalculateYCoordinateOnLogScale(
                    coordinate.y,
                    originPoint,
                    rotatedSortedYAxisPoints[yAxisIndex]);
            }
            else {
                y = this.reverseCalculateYCoordinateOnLinearScale(
                    coordinate.y,
                    originPoint,
                    rotatedSortedYAxisPoints[yAxisIndex]);
            }
        }
        else {
            if (rotatedSortedYAxisPoints[yAxisIndex].isLogScale
                && rotatedSortedYAxisPoints[yAxisIndex].logBase) {
                y = this.reverseCalculateYCoordinateOnLogScale(
                    coordinate.y,
                    rotatedSortedYAxisPoints[yAxisIndex - 1],
                    rotatedSortedYAxisPoints[yAxisIndex]);
            }
            else {
                y = this.reverseCalculateYCoordinateOnLinearScale(
                    coordinate.y,
                    rotatedSortedYAxisPoints[yAxisIndex - 1],
                    rotatedSortedYAxisPoints[yAxisIndex]);
            }
        }

        const { reverseXAngle, reverseYAngle } = this.reverseCalculateRotationAngles(originPoint, sortedXAxisPoints[xAxisIndex], sortedYAxisPoints[yAxisIndex]);
        const originalCoordinate = this.rotatePoint(x, y, originPoint, reverseXAngle, reverseYAngle);

        return originalCoordinate;
    }

    private sortAxisPoints(points: AxisPoint[], keyExtractor: (point: AxisPoint) => number): AxisPoint[] {
        return points.slice().sort((a, b) => keyExtractor(a) - keyExtractor(b));
    }

    private getSortedXAxisPoints(data: Graph): AxisPoint[] {
        const xAxisPoints = Array<AxisPoint>();

        data.xAxisPoints.forEach(x => {
            xAxisPoints.push(x);
        });

        xAxisPoints.sort((a, b) => a.xCoordinate - b.xCoordinate);

        return xAxisPoints;
    }

    private getSortedYAxisPoints(data: Graph): AxisPoint[] {
        const yAxisPoints = Array<AxisPoint>();

        data.yAxisPoints.forEach(y => {
            yAxisPoints.push(y);
        });

        yAxisPoints.sort((a, b) => a.yCoordinate - b.yCoordinate);

        return yAxisPoints;
    }

    private calculateResultCoordinates(
        coordinates: Point[],
        originPoint: AxisPoint,
        xAxisPointsSorted: AxisPoint[],
        yAxisPointsSorted: AxisPoint[]): Point[] {
        const result = Array<Point>();

        for (let i = 0; i < coordinates.length; i++) {
            const xAxisIndex = this.currentXAxisIndex(xAxisPointsSorted, coordinates[i]);
            const yAxisIndex = this.currentYAxisIndex(yAxisPointsSorted, coordinates[i]);

            const { xAngle, yAngle } = this.calculateRotationAngles(originPoint, xAxisPointsSorted[xAxisIndex], yAxisPointsSorted[yAxisIndex]);

            const currentPoint = coordinates[i];
            const rotatedPoint = this.rotatePoint(currentPoint.x, currentPoint.y, originPoint, xAngle, yAngle);
            const rotatedXAxisSortedPoints = this.rotateAxisPoints(xAxisPointsSorted, originPoint, xAngle, yAngle);
            const rotatedYAxisSortedPoints = this.rotateAxisPoints(yAxisPointsSorted, originPoint, xAngle, yAngle);

            let x = 0;
            let y = 0;

            if (xAxisIndex == 0) {
                if (rotatedXAxisSortedPoints[xAxisIndex].isLogScale
                    && rotatedXAxisSortedPoints[xAxisIndex].logBase) {
                    x = this.calculateXCoordinateOnLogScale(
                        rotatedPoint.x,
                        originPoint,
                        rotatedXAxisSortedPoints[xAxisIndex]);
                }
                else {
                    x = this.calculateXCoordinateOnLinearScale(
                        rotatedPoint.x,
                        originPoint,
                        rotatedXAxisSortedPoints[xAxisIndex]);
                }
            }
            else {
                if (rotatedXAxisSortedPoints[xAxisIndex].isLogScale
                    && rotatedXAxisSortedPoints[xAxisIndex].logBase) {
                    x = this.calculateXCoordinateOnLogScale(
                        rotatedPoint.x,
                        rotatedXAxisSortedPoints[xAxisIndex - 1],
                        rotatedXAxisSortedPoints[xAxisIndex]);
                }
                else {
                    x = this.calculateXCoordinateOnLinearScale(
                        rotatedPoint.x,
                        rotatedXAxisSortedPoints[xAxisIndex - 1],
                        rotatedXAxisSortedPoints[xAxisIndex]);
                }
            }

            if (yAxisIndex == 0) {
                if (rotatedYAxisSortedPoints[yAxisIndex].isLogScale
                    && rotatedYAxisSortedPoints[yAxisIndex].logBase) {
                    y = this.calculateYCoordinateOnLogScale(
                        rotatedPoint.y,
                        originPoint,
                        rotatedYAxisSortedPoints[yAxisIndex]);
                }
                else {
                    y = this.calculateYCoordinateOnLinearScale(
                        rotatedPoint.y,
                        originPoint,
                        rotatedYAxisSortedPoints[yAxisIndex]);
                }
            }
            else {
                if (rotatedYAxisSortedPoints[yAxisIndex].isLogScale
                    && rotatedYAxisSortedPoints[yAxisIndex].logBase) {
                    y = this.calculateYCoordinateOnLogScale(
                        rotatedPoint.y,
                        rotatedYAxisSortedPoints[yAxisIndex - 1],
                        rotatedYAxisSortedPoints[yAxisIndex]);
                }
                else {
                    y = this.calculateYCoordinateOnLinearScale(
                        rotatedPoint.y,
                        rotatedYAxisSortedPoints[yAxisIndex - 1],
                        rotatedYAxisSortedPoints[yAxisIndex]);
                }
            }

            result.push({ x: x, y: y });
        }

        return result;
    }

    private currentAxisIndex(
        axisPoints: AxisPoint[],
        coordinateValue: number,
        coordinateValueExtractor: (point: AxisPoint) => number
    ): number {
        if (axisPoints.length === 0) {
            return 0;
        }
        for (let i = 0; i < axisPoints.length; i++) {
            if (coordinateValue < coordinateValueExtractor(axisPoints[i])) {
                return i;
            }
        }
        return axisPoints.length - 1;
    }

    private currentXAxisIndex(xAxisPoints: AxisPoint[], coordinate: Point) {
        let index = 0;

        for (let i = 0; i < xAxisPoints.length; i++) {
            const point = xAxisPoints[i];
            index = i;

            if (coordinate.x < point.xCoordinate) {
                break;
            }
        }

        return index;
    }

    private currentYAxisIndex(yAxisPoints: AxisPoint[], coordinate: Point) {
        let index = 0;

        for (let i = 0; i < yAxisPoints.length; i++) {
            const point = yAxisPoints[i];
            index = i;

            if (coordinate.y < point.yCoordinate) {
                break;
            }
        }

        return index;
    }

    // Вычисление углов поворота X и Y относительно соответствующих осей.
    private calculateRotationAngles(originPoint: AxisPoint, xAxisPoint: AxisPoint, yAxisPoint: AxisPoint): { xAngle: number, yAngle: number } {
        const xAngle = this.calculateXAngle(originPoint, xAxisPoint);
        const yAngle = this.calculateYAngle(originPoint, yAxisPoint);

        const isOrthogonalAxis = this.isOrthogonalAxis(originPoint, xAxisPoint, yAxisPoint);
        const shouldUseRotation = this.shouldUseRotation(xAngle, yAngle);

        if (isOrthogonalAxis && shouldUseRotation) {
            return { xAngle, yAngle };
        }

        return { xAngle: 0, yAngle: 0 };
    }

    // Вычисление угла относительно оси X.
    private calculateXAngle(originPoint: AxisPoint, axisPoint: AxisPoint): number {
        let dx = axisPoint.xCoordinate - originPoint.xCoordinate;
        let dy = originPoint.yCoordinate - axisPoint.yCoordinate;
        return Math.atan2(dy, dx);
    }

    // Вычисление угла относительно оси Y.
    private calculateYAngle(originPoint: AxisPoint, axisPoint: AxisPoint): number {
        let dx = axisPoint.xCoordinate - originPoint.xCoordinate;
        let dy = axisPoint.yCoordinate - originPoint.yCoordinate;
        return Math.atan2(dx, dy);
    }

    private shouldUseRotation(xAngle: number, yAngle: number): boolean {
        // Максимальная угловая погрешность, при которой поворот не будет осуществляться.
        const tolerance = 0.01;

        return Math.abs(xAngle) > tolerance
            || Math.abs(yAngle) > tolerance;
    }

    private isOrthogonalAxis(originPoint: AxisPoint, xAxisPoint: AxisPoint, yAxisPoint: AxisPoint): boolean {
        const tolerance = 0.01;

        const shiftedXAxisPoint = { x: xAxisPoint.xCoordinate - originPoint.xCoordinate, y: xAxisPoint.yCoordinate - originPoint.yCoordinate };
        const shiftedYAxisPoint = { x: yAxisPoint.xCoordinate - originPoint.xCoordinate, y: yAxisPoint.yCoordinate - originPoint.yCoordinate };

        // Вычисляем скалярное произведение векторов
        const dotProduct = shiftedXAxisPoint.x * shiftedYAxisPoint.x + shiftedXAxisPoint.y * shiftedYAxisPoint.y;

        // Длины векторов
        const magnitudeU = Math.sqrt(shiftedXAxisPoint.x ** 2 + shiftedXAxisPoint.y ** 2);
        const magnitudeV = Math.sqrt(shiftedYAxisPoint.x ** 2 + shiftedYAxisPoint.y ** 2);

        // Косинус угла между векторами в радианах
        const cosTheta = dotProduct / (magnitudeU * magnitudeV);

        // Проверяем, что угол близок к 90 градусам (|cosTheta| близок к 0)
        return Math.abs(cosTheta) < tolerance;
    }

    // Выполнение поворота точки относительно точки начала координат.
    private rotatePoint(x: number, y: number, originPoint: AxisPoint, xAngle: number, yAngle: number): Point {
        const cosThetaX = Math.cos(xAngle);
        const sinThetaX = Math.sin(xAngle);
        const cosThetaY = Math.cos(yAngle);
        const sinThetaY = Math.sin(yAngle);

        const shiftedX = x - originPoint.xCoordinate;
        const shiftedY = y - originPoint.yCoordinate;

        const rotatedX = shiftedX * cosThetaX - shiftedY * sinThetaX;
        const rotatedY = shiftedX * sinThetaY + shiftedY * cosThetaY;

        const shiftedBackX = rotatedX + originPoint.xCoordinate;
        const shiftedBackY = rotatedY + originPoint.yCoordinate;

        return {
            x: shiftedBackX,
            y: shiftedBackY,
        } as Point;
    }

    // Выполнение поворота осевых точек относительно точки начала координат.
    private rotateAxisPoints(axisPoints: AxisPoint[], originPoint: AxisPoint, xAngle: number, yAngle: number): AxisPoint[] {
        const result = Array<AxisPoint>();

        axisPoints.forEach(point => {
            const rotatedPoint = this.rotatePoint(point.xCoordinate, point.yCoordinate, originPoint, xAngle, yAngle);
            const rotatedAxisPoint: AxisPoint = {
                xValue: point.xValue,
                yValue: point.yValue,
                xCoordinate: rotatedPoint.x,
                yCoordinate: rotatedPoint.y,
                isLogScale: point.isLogScale,
                logBase: point.logBase,
            }
            result.push(rotatedAxisPoint);
        });

        return result;
    }

    private calculateXCoordinateOnLogScale(tempXCoordinate: number, startScalePoint: AxisPoint, endScalePoint: AxisPoint): number {
        return startScalePoint.xValue * Math.pow(
            endScalePoint.xValue / startScalePoint.xValue,
            (tempXCoordinate - startScalePoint.xCoordinate) / (endScalePoint.xCoordinate - startScalePoint.xCoordinate))
    }

    private calculateYCoordinateOnLogScale(tempYCoordinate: number, startScalePoint: AxisPoint, endScalePoint: AxisPoint): number {
        return startScalePoint.yValue * Math.pow(
            endScalePoint.yValue / startScalePoint.yValue,
            (tempYCoordinate - startScalePoint.yCoordinate) / (endScalePoint.yCoordinate - startScalePoint.yCoordinate))
    }

    private calculateXCoordinateOnLinearScale(tempXCoordinate: number, startScalePoint: AxisPoint, endScalePoint: AxisPoint): number {
        return startScalePoint.xValue +
            (endScalePoint.xValue - startScalePoint.xValue) / (endScalePoint.xCoordinate - startScalePoint.xCoordinate) *
            (tempXCoordinate - startScalePoint.xCoordinate)
    }

    private calculateYCoordinateOnLinearScale(tempYCoordinate: number, startScalePoint: AxisPoint, endScalePoint: AxisPoint): number {
        return startScalePoint.yValue +
            (endScalePoint.yValue - startScalePoint.yValue) / (endScalePoint.yCoordinate - startScalePoint.yCoordinate) *
            (tempYCoordinate - startScalePoint.yCoordinate)
    }

    // Вычисление обратных углов поворота X и Y относительно соответствующих осей.
    private reverseCalculateRotationAngles(
        originPoint: AxisPoint,
        xAxisPoint: AxisPoint,
        yAxisPoint: AxisPoint
    ): { reverseXAngle: number, reverseYAngle: number } {
        const reverseXAngle = this.reverseCalculateXAngle(originPoint, xAxisPoint);
        const reverseYAngle = this.reverseCalculateYAngle(originPoint, yAxisPoint);

        const isOrthogonalAxis = this.isOrthogonalAxis(originPoint, xAxisPoint, yAxisPoint);
        const shouldUseRotation = this.shouldUseRotation(reverseXAngle, reverseYAngle);

        if (isOrthogonalAxis && shouldUseRotation) {
            return { reverseXAngle, reverseYAngle };
        }

        return { reverseXAngle: 0, reverseYAngle: 0 };
    }

    // Вычисление обратного угла поворота относительно оси X.
    private reverseCalculateXAngle(originPoint: AxisPoint, axisPoint: AxisPoint): number {
        let dx = axisPoint.xCoordinate - originPoint.xCoordinate;
        let dy = originPoint.yCoordinate - axisPoint.yCoordinate;
        return Math.atan2(-dy, dx);
    }

    // Вычисление обратного угла поворота относительно оси Y.
    private reverseCalculateYAngle(originPoint: AxisPoint, axisPoint: AxisPoint): number {
        let dx = axisPoint.xCoordinate - originPoint.xCoordinate;
        let dy = axisPoint.yCoordinate - originPoint.yCoordinate;
        return Math.atan2(-dx, dy);
    }

    private reverseCalculateXCoordinateOnLogScale(
        valueOnScale: number,
        startScalePoint: AxisPoint,
        endScalePoint: AxisPoint
    ): number {
        const deltaCoordinate = endScalePoint.xCoordinate - startScalePoint.xCoordinate;
        const ratio = endScalePoint.xValue / startScalePoint.xValue;

        if (ratio <= 0) {
            throw new Error("Invalid ratio for logarithms: end.xValue must be greater than start.xValue and both positive.");
        }

        const logRatio = Math.log(ratio);
        return startScalePoint.xCoordinate + (deltaCoordinate * Math.log(valueOnScale / startScalePoint.xValue)) / logRatio;
    }

    private reverseCalculateYCoordinateOnLogScale(
        valueOnScale: number,
        startScalePoint: AxisPoint,
        endScalePoint: AxisPoint
    ): number {
        const deltaCoordinate = endScalePoint.yCoordinate - startScalePoint.yCoordinate;
        const ratio = endScalePoint.yValue / startScalePoint.yValue;

        if (ratio <= 0) {
            throw new Error("Invalid ratio for logarithms: end.yValue must be greater than start.yValue and both positive.");
        }

        const logRatio = Math.log(ratio);
        return startScalePoint.yCoordinate + (deltaCoordinate * Math.log(valueOnScale / startScalePoint.yValue)) / logRatio;
    }

    private reverseCalculateXCoordinateOnLinearScale(
        valueOnScale: number,
        startScalePoint: AxisPoint,
        endScalePoint: AxisPoint
    ): number {
        const deltaValue = endScalePoint.xValue - startScalePoint.xValue;
        const deltaCoordinate = endScalePoint.xCoordinate - startScalePoint.xCoordinate;

        if (deltaCoordinate === 0) {
            throw new Error("Division by zero: start and end coordinates cannot be equal.");
        }

        const slope = deltaValue / deltaCoordinate;
        return startScalePoint.xCoordinate + (valueOnScale - startScalePoint.xValue) / slope;
    }

    private reverseCalculateYCoordinateOnLinearScale(
        valueOnScale: number,
        startScalePoint: AxisPoint,
        endScalePoint: AxisPoint
    ): number {
        const deltaValue = endScalePoint.yValue - startScalePoint.yValue;
        const deltaCoordinate = endScalePoint.yCoordinate - startScalePoint.yCoordinate;

        if (deltaCoordinate === 0) {
            throw new Error("Division by zero: start and end coordinates cannot be equal.");
        }

        const slope = deltaValue / deltaCoordinate;
        return startScalePoint.yCoordinate + (valueOnScale - startScalePoint.yValue) / slope;
    }
}

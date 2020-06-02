import { WindowSize } from '../models/window-size';

function toMilliseconds(windowSize: WindowSize): number {
    switch (windowSize.unit) {
        case 'hour':
            return windowSize.value * 60 * 60 * 1000;
        case 'minute':
            return windowSize.value * 60 * 1000;
        case 'second':
        default:
            return windowSize.value * 1000;
    }
}

export function convertWindowSizeToDateTime(windowSize: WindowSize): Date {
    const millisecondsToSubtract = toMilliseconds(windowSize);
    return new Date(Date.now() - millisecondsToSubtract);
}

import eventService from './services/events-service';
import NotFoundError from './errors/not-found-error';

const engine = {
    async processEvent(id, eventPayload) {
        const event = await eventService.getById(id);
        if (!event) {
            throw new NotFoundError();
        }
        return;
    }
};
export default engine;

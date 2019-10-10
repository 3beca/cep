import eventTypesService from './services/event-types-service';
import NotFoundError from './errors/not-found-error';

const engine = {
    async processEvent(id, eventPayload) {
        const event = await eventTypesService.getById(id);
        if (!event) {
            throw new NotFoundError();
        }
        return;
    }
};
export default engine;

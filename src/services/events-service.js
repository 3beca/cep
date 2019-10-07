const events = [];

const eventService = {
    async list(page, pageSize) {
        return events;
    },
    async create(event) {
        events.push(event);
        return event;
    }
};
export default eventService;

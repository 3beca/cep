export default class ConflictError extends Error {
    constructor(message, id) {
        super(message);
        this.id = id;
    }
}

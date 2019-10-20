export function toDto(item) {
    if (!item) {
        return item;
    }
    const { _id, ...rest } = item;
    return { ...rest, id: _id.toString() };
}

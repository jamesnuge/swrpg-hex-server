const isHost = (userId, sessionId) => {
    return userId === sessionId;
}

module.exports = {
    isHost
}
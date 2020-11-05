const isHost = (userId, sessionId) => {
    return userId === sessionId;
}

const isProduction = () => process.env.NODE_ENV === 'production';

module.exports = {
    isHost,
    isProduction
}
const express = require('express');
const dotenv = require('dotenv');
const userRouter = require('./routes/userRoutes');
const eventRouter = require('./routes/eventRoutes');
const MongoDB = require('./db/mongo');

const app = express();

app.use(express.json());

app.use('/users', userRouter);
app.use('/events', eventRouter);

// When running `node src/app.js` (dev/start), boot the server.
// When importing (tests), only export the app.
if (require.main === module) {
    dotenv.config();
    const PORT = process.env.PORT || 3000;

    MongoDB();

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
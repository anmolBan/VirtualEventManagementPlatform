const express = require('express');
const dotenv = require('dotenv');
const userRouter = require('./routes/userRoutes');
const MongoDB = require('./db/mongo');

dotenv.config();
const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());

MongoDB();

app.use('/users', userRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
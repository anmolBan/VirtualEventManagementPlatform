const express = require('express');
const userRouter = express.Router();
const { userRegistrationSchema, userLoginSchema } = require('../zodValidation/userSchemas');
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

userRouter.get('/', (req, res) => {
    res.send('User route');
});

userRouter.post('/register', async (req, res) => {
    const body = req.body;
    const validationResult = userRegistrationSchema.safeParse(body);

    if (!validationResult.success) {
        return res.status(400).json({ errors: validationResult.error.errors });
    }

    const { name, username, email, password } = validationResult.data;

    try{
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: 'Email or username already in use' });
        }
        const passwordHash = bcrypt.hashSync(password, 10);
    
        const newUser = new User({
            name,
            username,
            email,
            passwordHash,
        });

        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: "Error registering user", error: 'Internal server error' });
    }
});

userRouter.post('/login', async (req, res) => {
    const body = req.body;
    const validationResult = userLoginSchema.safeParse(body);

    if (!validationResult.success) {
        return res.status(400).json({ errors: validationResult.error.errors });
    }

    const { email, password } = validationResult.data;
    try{
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const passwordMatch = bcrypt.compareSync(password, user.passwordHash);
        if (!passwordMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET);
        res.json({ message: "Login successful", token });
    } catch (error) {
        res.status(500).json({ message: "Error logging in", error: 'Internal server error' });
    }
});

module.exports = userRouter;
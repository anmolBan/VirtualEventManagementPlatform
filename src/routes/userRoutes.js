const express = require('express');
const userRouter = express.Router();
const { userRegistrationSchema } = require('../zodValidation/userSchemas');
const User = require('../models/userModel');
const bcrypt = require('bcrypt');

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

module.exports = userRouter;
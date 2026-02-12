const express = require('express');
const eventRouter = express.Router();
const Event = require('../models/eventModel');
const { eventCreationSchema } = require('../zodValidation/eventValidationSchema');

eventRouter.get('/', async (req, res) => {
    try{
        const events = await Event.find();
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

eventRouter.post('/', async (req, res) => {
    const body = req.body;
    const isValid = eventCreationSchema.safeParse(body);
    if (!isValid.success) {
        return res.status(400).json({ errors: isValid.error.errors });
    }
    try{
        const newEvent = new Event(isValid.data);
        await newEvent.save();
        res.status(201).json({ message: "Event created successfully", event: newEvent });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = eventRouter;
const express = require('express');
const eventRouter = express.Router();
const mongoose = require('mongoose');
const Event = require('../models/eventModel');
const EventRegistration = require('../models/eventRegistrationModel');
const { eventCreationSchema, eventUpdateSchema } = require('../zodValidation/eventValidationSchema');
const requireAuth = require('../middleware/auth');

eventRouter.get('/', requireAuth, async (req, res) => {
    try{
        const events = await Event.find();
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

eventRouter.get('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try{
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        } else {
            res.status(200).json(event);
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

eventRouter.post('/', requireAuth, async (req, res) => {
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

eventRouter.put('/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const isValid = eventUpdateSchema.safeParse(body);
    if (!isValid.success) {
        return res.status(400).json({ errors: isValid.error.errors });
    }
    try{
        const updatedEvent = await Event.findByIdAndUpdate(id, isValid.data, { new: true });
        if (!updatedEvent) {
            return res.status(404).json({ message: "Event not found" });
        }
        res.status(200).json({ message: "Event updated successfully", event: updatedEvent });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

eventRouter.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try{
        const deletedEvent = await Event.findByIdAndDelete(id);
        if (!deletedEvent) {
            return res.status(404).json({ message: "Event not found" });
        }
        res.status(200).json({ message: "Event deleted successfully", event: deletedEvent });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

eventRouter.post('/:id/register', requireAuth, async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }

    const { userId } = req.user || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(401).json({ message: 'Invalid user in token' });
    }

    const now = new Date();
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const session = await mongoose.startSession();
    try {
        let txResult;

        await session.withTransaction(async () => {
            const updatedEvent = await Event.findOneAndUpdate(
                {
                    $and: [
                        { _id: id },
                        { status: 'published' },
                        {
                            $or: [
                                { registrationDeadline: { $exists: false } },
                                { registrationDeadline: null },
                                { registrationDeadline: { $gte: now } },
                            ],
                        },
                        {
                            $or: [
                                { attendees: userObjectId },
                                { isUnlimitedCapacity: true },
                                {
                                    $expr: {
                                        $lt: [
                                            { $size: { $ifNull: ['$attendees', []] } },
                                            { $ifNull: ['$capacity', 0] },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
                { $addToSet: { attendees: userObjectId } },
                { new: true, session }
            );

            if (!updatedEvent) {
                const event = await Event.findById(id)
                    .select('status registrationDeadline isUnlimitedCapacity capacity attendees')
                    .session(session);

                const err = new Error('Unable to register for this event');
                if (!event) {
                    err.status = 404;
                    err.message = 'Event not found';
                    throw err;
                }
                if (event.status !== 'published') {
                    err.status = 400;
                    err.message = 'Event is not open for registration';
                    throw err;
                }
                if (event.registrationDeadline && event.registrationDeadline < now) {
                    err.status = 400;
                    err.message = 'Registration deadline has passed';
                    throw err;
                }
                if (!event.isUnlimitedCapacity && event.attendees.length >= event.capacity) {
                    err.status = 400;
                    err.message = 'Event is full';
                    throw err;
                }

                err.status = 400;
                throw err;
            }

            const registration = await EventRegistration.findOneAndUpdate(
                { event: updatedEvent._id, user: userObjectId },
                {
                    $set: { status: 'registered', cancelledAt: null },
                    $setOnInsert: { registeredAt: now, source: 'api' },
                },
                { upsert: true, new: true, session }
            );

            txResult = { updatedEvent, registration };
        });

        return res.status(200).json({
            message: 'Registered successfully',
            registration: txResult.registration,
            event: txResult.updatedEvent,
        });
    } catch (error) {
        if (error && error.code === 11000) {
            return res.status(200).json({ message: 'Already registered' });
        }
        return res.status(error.status || 500).json({ message: error.message });
    } finally {
        session.endSession();
    }
});




module.exports = eventRouter;
const express = require('express');
const eventRouter = express.Router();
const mongoose = require('mongoose');
const Event = require('../models/eventModel');
const EventRegistration = require('../models/eventRegistrationModel');
const User = require('../models/userModel');
const { eventCreationSchema, eventUpdateSchema } = require('../zodValidation/eventValidationSchema');
const requireAuth = require('../middleware/auth');
const { Resend } = require('resend');

//get all the registered events for a user
eventRouter.get('/my-registrations', requireAuth, async (req, res) => {
    const { userId } = req.user || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(401).json({ message: 'Invalid user in token' });
    }
    try {
        const registrations = await EventRegistration.find({ user: userId })
            .populate('event')
            .exec();
        res.status(200).json(registrations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//get event by id endpoint
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

// create event endpoint - validate the input using zod schema and only allow authenticated users to create events
eventRouter.post('/create', requireAuth, async (req, res) => {
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

// update event endpoint - only allow updating certain fields and validate the input using zod schema
eventRouter.put('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const isValid = eventUpdateSchema.safeParse(body);
    if (!isValid.success) {
        return res.status(400).json({ errors: isValid.error.errors });
    }
    try{
        const updatedEvent = await Event.findByIdAndUpdate(id, isValid.data, { returnDocument: 'after' });
        if (!updatedEvent) {
            return res.status(404).json({ message: "Event not found" });
        }
        res.status(200).json({ message: "Event updated successfully", event: updatedEvent });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// delete event endpoint - only if there are no attendees registered for the event
eventRouter.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        if (event.attendees && event.attendees.length > 0) {
            return res.status(400).json({ message: 'Cannot delete event with registered attendees' });
        }
        await Event.findByIdAndDelete(id);
        res.status(200).json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//event registration endpoint
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

    try {
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
            { returnDocument: 'after' }
        );

        if (!updatedEvent) {
            const event = await Event.findById(id).select('status registrationDeadline isUnlimitedCapacity capacity attendees');
            if (!event) {
                return res.status(404).json({ message: 'Event not found' });
            }
            if (event.status !== 'published') {
                return res.status(400).json({ message: 'Event is not open for registration' });
            }
            if (event.registrationDeadline && event.registrationDeadline < now) {
                return res.status(400).json({ message: 'Registration deadline has passed' });
            }
            if (!event.isUnlimitedCapacity && event.attendees.length >= event.capacity) {
                return res.status(400).json({ message: 'Event is full' });
            }
            return res.status(400).json({ message: 'Unable to register for this event' });
        }

        let registration;
        try {
            registration = await EventRegistration.findOneAndUpdate(
                { event: updatedEvent._id, user: userObjectId },
                {
                    $set: { status: 'registered', cancelledAt: null },
                    $setOnInsert: { registeredAt: now, source: 'api' },
                },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (error) {
            if (error && error.code === 11000) {
                registration = await EventRegistration.findOne({ event: updatedEvent._id, user: userObjectId });
                return res.status(200).json({ message: 'Already registered', registration, event: updatedEvent });
            }

            // Best-effort compensation if registration write fails after event update
            await Event.updateOne({ _id: updatedEvent._id }, { $pull: { attendees: userObjectId } }).catch(() => {});
            throw error;
        }

        const canSendEmail = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
        if (!canSendEmail) {
            console.warn('Registration email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL not set');
        } else {
            try {
                const user = await User.findById(userObjectId).select('email name');

                if (user?.email) {
                    const resend = new Resend(process.env.RESEND_API_KEY);
                    const { data, error } = await resend.emails.send({
                        from: process.env.RESEND_FROM_EMAIL,
                        to: user.email,
                        subject: `Registration Confirmed: ${updatedEvent.title}`,
                        html: `<p>Hi${user.name ? ` ${user.name}` : ''},</p><p>You have successfully registered for the event: <strong>${updatedEvent.title}</strong>.</p><p>Event Details:</p><ul><li><strong>Title:</strong> ${updatedEvent.title}</li><li><strong>Description:</strong> ${updatedEvent.description}</li><li><strong>Mode:</strong> ${updatedEvent.mode}</li><li><strong>Start Time:</strong> ${updatedEvent.startAt.toLocaleString()}</li><li><strong>End Time:</strong> ${updatedEvent.endAt ? updatedEvent.endAt.toLocaleString() : 'N/A'}</li></ul><p>Thank you for registering!</p>`,
                    });

                    if (error) {
                        console.error('Resend email send error:', error);
                    } else {
                        console.log('Resend email sent:', data);
                    }
                } else {
                    console.warn('Registration email skipped: user has no email');
                }
            } catch (emailError) {
                // Don't fail the registration if email sending fails
                console.error('Failed to send registration email:', emailError);
            }
        }
        return res.status(200).json({ message: 'Registered successfully', registration, event: updatedEvent });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
});

//get all the attendees for an event
eventRouter.get('/:id/attendees', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid event id' });
    }
    try {
        const event = await Event.findById(id).populate('attendees', 'name email'); 
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(200).json(event.attendees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = eventRouter;
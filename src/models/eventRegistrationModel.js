const mongoose = require('mongoose');

const { Schema } = mongoose;

const EventRegistrationSchema = new Schema(
    {
        event: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['registered', 'cancelled', 'waitlisted'],
            default: 'registered',
            index: true,
        },
        registeredAt: {
            type: Date,
            default: Date.now,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        source: {
            type: String,
            trim: true,
            maxlength: 100,
            default: 'api',
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

EventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });

const EventRegistration = mongoose.model('EventRegistration', EventRegistrationSchema);

module.exports = EventRegistration;

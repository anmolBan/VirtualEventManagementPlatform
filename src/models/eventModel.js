const mongoose = require('mongoose');

const { Schema } = mongoose;

const EventSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
			minlength: 3,
			maxlength: 200,
		},
		description: {
			type: String,
			trim: true,
			maxlength: 5000,
			default: '',
		},
		mode: {
			type: String,
			enum: ['virtual', 'in-person', 'hybrid'],
			default: 'virtual',
			index: true,
		},
		startAt: {
			type: Date,
			required: true,
			index: true,
		},
		endAt: {
			type: Date,
			validate: {
				validator: function (value) {
					if (!value) return true;
					if (!this.startAt) return true;
					return value > this.startAt;
				},
				message: 'endAt must be after startAt',
			},
		},
		registrationDeadline: {
			type: Date,
			validate: {
				validator: function (value) {
					if (!value) return true;
					if (!this.startAt) return true;
					return value <= this.startAt;
				},
				message: 'registrationDeadline must be on/before startAt',
			},
		},
		capacity: {
			type: Number,
			min: 1,
			default: 100,
		},
		isUnlimitedCapacity: {
			type: Boolean,
			default: false,
		},
		attendees: [
			{
				type: Schema.Types.ObjectId,
				ref: 'User',
			},
		],
		meetingUrl: {
			type: String,
			trim: true,
			validate: {
				validator: function (value) {
					if (!value) {
						return this.mode === 'in-person';
					}

					try {
						// eslint-disable-next-line no-new
						new URL(value);
						return true;
					} catch {
						return false;
					}
				},
				message: 'meetingUrl must be a valid URL (required for virtual/hybrid)',
			},
		},
		location: {
			addressLine1: { type: String, trim: true, maxlength: 200, default: '' },
			addressLine2: { type: String, trim: true, maxlength: 200, default: '' },
			city: { type: String, trim: true, maxlength: 100, default: '' },
			state: { type: String, trim: true, maxlength: 100, default: '' },
			country: { type: String, trim: true, maxlength: 100, default: '' },
			postalCode: { type: String, trim: true, maxlength: 30, default: '' },
		},
		status: {
			type: String,
			enum: ['draft', 'published', 'cancelled', 'completed'],
			default: 'draft',
			index: true,
		},
		isPublic: {
			type: Boolean,
			default: true,
			index: true,
		},
		tags: {
			type: [String],
			default: [],
		},
		price: {
			type: Number,
			min: 0,
			default: 0,
		},
	},
	{
		timestamps: true,
	}
);

EventSchema.index({ organizer: 1, startAt: 1 });

const Event = mongoose.model('Event', EventSchema);

module.exports = Event;

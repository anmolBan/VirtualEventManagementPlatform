const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const Event = require('../src/models/eventModel');
const User = require('../src/models/userModel');
const EventRegistration = require('../src/models/eventRegistrationModel');

let mongoServer;

async function registerAndLogin() {
    const unique = Math.random().toString(36).slice(2, 8);
    const email = `user_${unique}@example.com`;
    const password = 'secret123';

    await request(app)
        .post('/users/register')
        .send({ name: 'Test User', username: `u${unique}`.slice(0, 15), email, password })
        .expect(201);

    const loginRes = await request(app)
        .post('/users/login')
        .send({ email, password })
        .expect(200);

    expect(loginRes.body.token).toBeTruthy();

    return {
        token: loginRes.body.token,
        email,
    };
}

beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

    // Ensure email sending is skipped in tests
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
});

beforeEach(async () => {
    await Promise.all([
        Event.deleteMany({}),
        User.deleteMany({}),
        EventRegistration.deleteMany({}),
    ]);
});

describe('Virtual Event Management Platform API', () => {
    test('register + login works and returns JWT', async () => {
        const { token } = await registerAndLogin();
        expect(typeof token).toBe('string');
    });

    test('create event (auth required) and fetch by id', async () => {
        const { token } = await registerAndLogin();

        const createRes = await request(app)
            .post('/events/create')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Test Event',
                description: 'Hello',
                mode: 'virtual',
                startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                endAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                capacity: 50,
                tags: ['test'],
                price: 0,
            })
            .expect(201);

        expect(createRes.body.event).toBeTruthy();
        const eventId = createRes.body.event._id;

        const getRes = await request(app)
            .get(`/events/${eventId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(getRes.body._id).toBe(eventId);
        expect(getRes.body.title).toBe('Test Event');
    });

    test('update event (auth required)', async () => {
        const { token } = await registerAndLogin();

        const event = await Event.create({
            title: 'Old Title',
            startAt: new Date(Date.now() + 60 * 60 * 1000),
            status: 'published',
        });

        const res = await request(app)
            .put(`/events/${event._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'New Title' })
            .expect(200);

        expect(res.body.event.title).toBe('New Title');
    });

    test('delete event fails if attendees exist', async () => {
        const { token } = await registerAndLogin();

        const attendee = await User.create({
            name: 'Attendee',
            username: 'attendee1',
            email: 'attendee1@example.com',
            passwordHash: 'hash',
        });

        const event = await Event.create({
            title: 'Delete Blocked',
            startAt: new Date(Date.now() + 60 * 60 * 1000),
            status: 'published',
            attendees: [attendee._id],
        });

        const res = await request(app)
            .delete(`/events/${event._id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(400);

        expect(res.body.message).toMatch(/Cannot delete event with registered attendees/i);
    });

    test('registering for an event creates EventRegistration and adds attendee', async () => {
        const { token, email } = await registerAndLogin();

        const user = await User.findOne({ email });
        expect(user).toBeTruthy();

        const event = await Event.create({
            title: 'Publish Event',
            startAt: new Date(Date.now() + 60 * 60 * 1000),
            endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
            status: 'published',
            capacity: 10,
            isUnlimitedCapacity: false,
        });

        const regRes = await request(app)
            .post(`/events/${event._id}/register`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(regRes.body.registration).toBeTruthy();
        expect(regRes.body.event).toBeTruthy();

        const registration = await EventRegistration.findOne({ event: event._id, user: user._id });
        expect(registration).toBeTruthy();
        expect(registration.status).toBe('registered');

        const updatedEvent = await Event.findById(event._id);
        expect(updatedEvent.attendees.map((id) => id.toString())).toContain(user._id.toString());
    });

    test('registration fails if deadline passed', async () => {
        const { token, email } = await registerAndLogin();
        const user = await User.findOne({ email });

        const event = await Event.create({
            title: 'Deadline Event',
            startAt: new Date(Date.now() + 60 * 60 * 1000),
            status: 'published',
            registrationDeadline: new Date(Date.now() - 60 * 1000),
        });

        const res = await request(app)
            .post(`/events/${event._id}/register`)
            .set('Authorization', `Bearer ${token}`)
            .expect(400);

        expect(res.body.message).toMatch(/deadline/i);

        const registration = await EventRegistration.findOne({ event: event._id, user: user._id });
        expect(registration).toBeNull();
    });

    test('registration fails if event is full', async () => {
        const { token, email } = await registerAndLogin();
        const user = await User.findOne({ email });

        const otherUser = await User.create({
            name: 'Other',
            username: 'other1',
            email: 'other1@example.com',
            passwordHash: 'hash',
        });

        const event = await Event.create({
            title: 'Full Event',
            startAt: new Date(Date.now() + 60 * 60 * 1000),
            status: 'published',
            capacity: 1,
            isUnlimitedCapacity: false,
            attendees: [otherUser._id],
        });

        const res = await request(app)
            .post(`/events/${event._id}/register`)
            .set('Authorization', `Bearer ${token}`)
            .expect(400);

        expect(res.body.message).toMatch(/full/i);

        const updatedEvent = await Event.findById(event._id);
        expect(updatedEvent.attendees.map((id) => id.toString())).not.toContain(user._id.toString());
    });

    test('get my registrations returns populated event', async () => {
        const { token, email } = await registerAndLogin();
        const user = await User.findOne({ email });

        const event = await Event.create({
            title: 'My Reg Event',
            startAt: new Date(Date.now() + 60 * 60 * 1000),
            status: 'published',
        });

        await EventRegistration.create({
            event: event._id,
            user: user._id,
            status: 'registered',
        });

        const res = await request(app)
            .get('/events/my-registrations')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].event).toBeTruthy();
        expect(res.body[0].event.title).toBe('My Reg Event');
    });

    test('get attendees returns users (name/email)', async () => {
        const { token, email } = await registerAndLogin();
        const user = await User.findOne({ email });

        const event = await Event.create({
            title: 'Attendees Event',
            startAt: new Date(Date.now() + 60 * 60 * 1000),
            status: 'published',
            attendees: [user._id],
        });

        const res = await request(app)
            .get(`/events/${event._id}/attendees`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].email).toBe(email);
        expect(res.body[0].name).toBeTruthy();
    });
});

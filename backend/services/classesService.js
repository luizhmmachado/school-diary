const { v4: uuid } = require('uuid');
const { PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamo } = require('../config/dbClient');

const TABLE = process.env.DYNAMODB_CLASSES_TABLE || 'school-diary-classes';

function now() {
  return new Date().toISOString();
}

function normalizeClassInput(payload = {}) {
  return {
    name: payload.name || 'Sem título',
    days: Array.isArray(payload.days) ? payload.days : (payload.days ? [payload.days] : []),
    schedule: payload.schedule || '',
    scheduleByDay: Array.isArray(payload.scheduleByDay)
      ? payload.scheduleByDay.map(s => ({
          date: s.date,
          start: s.start ?? ((s.slots && s.slots[0]?.start) || ''),
          end: s.end ?? ((s.slots && s.slots[0]?.end) || ''),
          slots: Array.isArray(s.slots)
            ? s.slots.map(slot => ({ start: slot.start || '', end: slot.end || '' }))
            : (s.start || s.end ? [{ start: s.start || '', end: s.end || '' }] : []),
        }))
      : [],
    imageUrl: payload.imageUrl || '',
    totalClasses: Number(payload.totalClasses) || 0,
    maxAbsences: payload.maxAbsences !== undefined ? Number(payload.maxAbsences) : null,
    minPresence: payload.minPresence !== undefined ? Number(payload.minPresence) : null,
    averageGrade: payload.averageGrade !== undefined ? Number(payload.averageGrade) : null,
    events: Array.isArray(payload.events) ? payload.events : (payload.events ? [payload.events] : []),
    absences: Number(payload.absences) || 0,
  };
}

async function listClasses(userId) {
  const params = {
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: {
      ':uid': userId,
    },
  };
  const res = await dynamo.send(new QueryCommand(params));
  return res.Items || [];
}

async function createClass(userId, payload) {
  const data = normalizeClassInput(payload);
  const item = {
    userId,
    classId: uuid(),
    ...data,
    createdAt: now(),
    updatedAt: now(),
  };
  await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateClass(userId, classId, payload) {
  const data = normalizeClassInput(payload);
  const updates = {
    '#name': 'name',
    days: data.days,
    schedule: data.schedule,
    scheduleByDay: data.scheduleByDay,
    imageUrl: data.imageUrl,
    totalClasses: data.totalClasses,
    maxAbsences: data.maxAbsences,
    minPresence: data.minPresence,
    averageGrade: data.averageGrade,
    events: data.events,
    absences: data.absences,
    updatedAt: now(),
  };

  const setParts = ['#name = :name', 'days = :days', 'schedule = :schedule', 'scheduleByDay = :scheduleByDay', 'imageUrl = :imageUrl', 'totalClasses = :totalClasses', 'maxAbsences = :maxAbsences', 'minPresence = :minPresence', 'averageGrade = :averageGrade', 'events = :events', 'absences = :absences', 'updatedAt = :updatedAt'];

  const params = {
    TableName: TABLE,
    Key: { userId, classId },
    UpdateExpression: `SET ${setParts.join(', ')}`,
    ExpressionAttributeNames: { '#name': 'name' },
    ExpressionAttributeValues: {
      ':name': data.name,
      ':days': data.days,
      ':schedule': data.schedule,
      ':scheduleByDay': data.scheduleByDay,
      ':imageUrl': data.imageUrl,
      ':totalClasses': data.totalClasses,
      ':maxAbsences': data.maxAbsences,
      ':minPresence': data.minPresence,
      ':averageGrade': data.averageGrade,
      ':events': data.events,
      ':absences': data.absences,
      ':updatedAt': updates.updatedAt,
    },
    ReturnValues: 'ALL_NEW',
  };

  const res = await dynamo.send(new UpdateCommand(params));
  return res.Attributes;
}

async function deleteClass(userId, classId) {
  const params = {
    TableName: TABLE,
    Key: { userId, classId },
  };
  await dynamo.send(new DeleteCommand(params));
  return { success: true };
}

module.exports = {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
};

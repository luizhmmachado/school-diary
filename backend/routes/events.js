const express = require('express');
const router = express.Router();
const { createEvent, listEventsByUser, deleteEvent } = require('../services/eventsService');

function requireUser(req, res, next) {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'x-user-id header é obrigatório' });
  req.userId = userId;
  next();
}

router.get('/', requireUser, async (req, res) => {
  try {
    const items = await listEventsByUser(req.userId);
    res.json(items);
  } catch (err) {
    console.error('Erro ao listar eventos', err);
    res.status(500).json({ error: 'Erro ao listar eventos' });
  }
});

router.post('/', requireUser, async (req, res) => {
  try {
    const item = await createEvent(req.userId, req.body || {});
    res.status(201).json(item);
  } catch (err) {
    console.error('Erro ao criar evento', err);
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

router.delete('/:eventId', requireUser, async (req, res) => {
  try {
    await deleteEvent(req.userId, req.params.eventId);
    res.status(204).send();
  } catch (err) {
    console.error('Erro ao deletar evento', err);
    res.status(500).json({ error: 'Erro ao deletar evento' });
  }
});

module.exports = router;

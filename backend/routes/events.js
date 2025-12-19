const express = require('express');
const router = express.Router();
const { createEvent, listEventsByUser } = require('../services/eventsService');

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

module.exports = router;

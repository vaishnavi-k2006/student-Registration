// frontend/src/App.jsx

import { useEffect, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

export default function App() {
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [newHabit, setNewHabit] = useState('');
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  const getLast7Days = () => {
    const days = [];
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const temp = new Date(d);
      temp.setDate(d.getDate() - i);
      days.push(temp.toISOString().split('T')[0]);
    }
    return days;
  };

  const refreshAll = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/habits`);
      const data = await res.json();
      setHabits(data);

      const map = {};

      await Promise.all(
        data.map(async (habit) => {
          try {
            const r = await fetch(`${API_URL}/habits/${habit.id}/checkins`);
            const d = await r.json();
            map[habit.id] = d;
          } catch (e) {
            console.error(e);
          }
        })
      );

      setCheckinsByHabit(map);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const addHabit = async () => {
    const trimmed = newHabit.trim();
    if (!trimmed) return;

    try {
      await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });

      setNewHabit('');
      refreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const checkIn = async (id) => {
    try {
      await fetch(`${API_URL}/habits/${id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      refreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteHabit = async (id) => {
    try {
      await fetch(`${API_URL}/habits/${id}`, {
        method: 'DELETE'
      });

      refreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const isCheckedToday = (habitId) => {
    const arr = checkinsByHabit[habitId] || [];
    return arr.includes(todayStr);
  };

  return (
    <div className="container">
      <h1>🔥 Habit Tracker</h1>

      {/* New Habit Card */}
      <div className="habit-card">
        <div className="new-habit-row">
          <input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHabit()}
            placeholder="e.g. Drink 2L water"
          />
          <button onClick={addHabit}>Add Habit</button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <p>Loading your habits...</p>
      ) : habits.length === 0 ? (
        <p>No habits yet. Add one above to get started!</p>
      ) : (
        habits.map((habit) => {
          const streak = habit.streak;
          const checkedToday = isCheckedToday(habit.id);
          const last7 = getLast7Days();

          return (
            <div key={habit.id} className="habit-card">
              <h3>{habit.name}</h3>

              <div className={`streak ${streak > 0 ? 'active' : ''}`}>
                {streak > 0
                  ? `🔥 ${streak} day streak`
                  : 'No streak yet — check in today!'}
              </div>

              <button
                disabled={checkedToday}
                onClick={() => checkIn(habit.id)}
                className={checkedToday ? 'checked-btn' : ''}
              >
                {checkedToday ? '✅ Checked in today' : 'Check In'}
              </button>

              <div className="calendar">
                {last7.map((date) => {
                  const done =
                    (checkinsByHabit[habit.id] || []).includes(date);

                  const dayNum = new Date(date).getDate();

                  return (
                    <div
                      key={date}
                      className={`day-box ${done ? 'done' : ''}`}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>

              <button
                className="delete-btn"
                onClick={() => deleteHabit(habit.id)}
              >
                Delete Habit
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
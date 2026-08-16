import React, { useEffect, useState } from 'react';
import { Spinner } from '../components/Spinner';
import { getPeople, deletePerson } from '../services/api';

const People = () => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    getPeople()
      .then(res => {
        setPeople(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (person) => {
    if (!window.confirm(`Delete person "${person.name}"? Tasks must be reassigned first.`)) return;
    try {
      await deletePerson(person.id);
      setError(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const peopleById = Object.fromEntries(people.map(p => [p.id, p]));

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-gray-800">People</h1>
        <p className="text-sm text-gray-500 mt-0.5">Team members, roles, and reporting lines.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Person</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Role</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Team</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Reports to</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Capacity</th>
                <th className="text-center p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Status</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map(person => (
                <tr key={person.id} className="border-b border-gray-100">
                  <td className="p-2.5">
                    <span className="font-semibold text-gray-900">{person.name}</span>
                    {person.role === 'lead' && (
                      <span className="ml-2 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Lead</span>
                    )}
                  </td>
                  <td className="p-2.5 capitalize text-gray-700">{person.role}</td>
                  <td className="p-2.5 text-gray-600">{person.team}</td>
                  <td className="p-2.5 text-gray-600">
                    {person.role === 'lead'
                      ? 'Boss'
                      : (person.managerId ? (peopleById[person.managerId]?.name || '—') : '—')}
                  </td>
                  <td className="p-2.5 text-right">{person.weeklyCapacity}h</td>
                  <td className="p-2.5 text-center">
                    <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Active</span>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      onClick={() => handleDelete(person)}
                      className="text-gray-300 hover:text-red-500"
                      title="Delete person"
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default People;
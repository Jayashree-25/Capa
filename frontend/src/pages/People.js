import React, { useEffect, useState, Fragment } from 'react';
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

  const groups = [];
  const teamIndex = {};
  for (const p of people) {
    const team = p.team || 'No team';
    if (!(team in teamIndex)) {
      teamIndex[team] = groups.length;
      groups.push({ team, leads: [], members: [], solo: [] });
    }
    const g = groups[teamIndex[team]];
    if (p.role === 'lead') {
      g.leads.push(p);
    } else if (p.managerId && peopleById[p.managerId]?.role === 'lead') {
      g.members.push(p);
    } else {
      g.solo.push(p);
    }
  }

  const renderRow = (person, indented) => (
    <tr key={person.id} className={`border-b border-gray-100 ${person.role === 'lead' ? 'bg-blue-50/40' : ''}`}>
      <td className={`p-2.5 ${indented ? 'pl-12' : ''}`}>
        <span className={person.role === 'lead' ? 'font-bold text-gray-900' : 'font-normal text-gray-600'}>
          {person.name}
        </span>
        {person.role === 'lead' && (
          <span className="ml-2 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Lead</span>
        )}
      </td>
      <td className="p-2.5 capitalize text-gray-700">{person.role}</td>
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
  );

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
          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Person</th>
                <th className="text-left p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Role</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Capacity</th>
                <th className="text-center p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Status</th>
                <th className="text-right p-2.5 border-b-2 border-gray-200 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gIndex) => (
                <Fragment key={g.team}>
                  <tr className={`px-2.5 py-2.5 bg-gray-50/70 ${gIndex === 0 ? '' : 'border-t border-gray-200'}`}>
                    <td colSpan={5} className="px-2.5 py-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{g.team}</span>
                    </td>
                  </tr>
                  {g.leads.map(person => renderRow(person, false))}
                  {g.members.map(person => renderRow(person, true))}
                  {g.solo.map(person => renderRow(person, false))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default People;
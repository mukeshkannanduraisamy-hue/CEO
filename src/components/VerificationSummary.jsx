import { useState, useEffect } from 'react';
import { ShieldAlert, Table } from 'lucide-react';
import api from '../lib/api';
import './VerificationSummary.css';

export default function VerificationSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [region, setRegion] = useState('All');
  const [portfolio, setPortfolio] = useState('All');

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (region !== 'All') params.append('region', region);
      if (portfolio !== 'All') params.append('portfolio', portfolio);
      
      const res = await api.get(`/zoho_reports/verification-summary?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch verification summary", err);
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [region, portfolio]);

  if (loading && !data) {
    return (
      <div className="vs-loading">
        <div className="vs-spinner" />
        <p>Loading Verification Summary...</p>
      </div>
    );
  }

  if (error) {
    return <div className="vs-error"><ShieldAlert size={24} /> {error}</div>;
  }

  if (!data) return null;

  const { statuses, data: rows, totals, available_regions, available_portfolios } = data;

  return (
    <div className="vs-container">
      <div className="vs-header-row">
        <div className="vs-header">
          <h1 className="vs-title"><Table className="vs-title-icon" size={28} /> Verification Summary</h1>
          <p className="vs-subtitle">Count of Investment Code by Marketer and Status</p>
        </div>
        
        <div className="vs-filters">
          <div className="vs-filter-group">
            <label>Region</label>
            <select value={region} onChange={e => setRegion(e.target.value)}>
              <option value="All">All Regions</option>
              {available_regions?.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="vs-filter-group">
            <label>Portfolio</label>
            <select value={portfolio} onChange={e => setPortfolio(e.target.value)}>
              <option value="All">All Portfolios</option>
              {available_portfolios?.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="vs-loading-overlay">Loading data...</div>}

      <div className={`vs-table-wrapper ${loading ? 'vs-table-loading' : ''}`}>
        <table className="vs-table">
          <thead>
            <tr>
              <th className="vs-th-marketer">MARKETER</th>
              {statuses.map(s => (
                <th key={s} className="vs-th-status">{s}</th>
              ))}
              <th className="vs-th-total">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="vs-td-marketer">{row.marketer}</td>
                {statuses.map(s => (
                  <td key={s} className="vs-td-val">
                    {row[s] > 0 ? row[s] : ''}
                  </td>
                ))}
                <td className="vs-td-total">{row.Total > 0 ? row.Total : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="vs-td-grand-label">Grand Total</td>
              {statuses.map(s => (
                <td key={s} className="vs-td-grand-val">{totals[s] > 0 ? totals[s] : ''}</td>
              ))}
              <td className="vs-td-grand-total">{totals.Total > 0 ? totals.Total : ''}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

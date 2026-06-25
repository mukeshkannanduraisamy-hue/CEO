import { useState, useRef, useEffect } from 'react';
import { Upload, Calendar, Clock, Play, FileText, X, AlertCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Scheduler() {
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [file, setFile] = useState(null);
  const [type, setType] = useState('email');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API}/api/schedule`);
      if (res.ok) {
        const data = await res.json();
        setScheduledJobs(data.jobs || []);
      }
    } catch (e) {
      console.error('Failed to fetch jobs', e);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!file || !date || !time || !message) {
      setStatus('Please fill all required fields.');
      return;
    }

    setLoading(true);
    setStatus('Scheduling...');

    const formData = new FormData();
    formData.append('csv_file', file);
    formData.append('type', type);
    formData.append('target_datetime', `${date}T${time}`);
    formData.append('message', message);
    if (type === 'email') {
      formData.append('subject', subject);
    }

    try {
      const res = await fetch(`${API}/api/schedule`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Job scheduled successfully! ID: ${data.job_id}`);
        setFile(null);
        setSubject('');
        setMessage('');
        fetchJobs();
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setStatus(`Error: ${data.detail || 'Failed to schedule'}`);
      }
    } catch (err) {
      setStatus(`Network error: ${err.message}`);
    }
    setLoading(false);
  };

  const deleteJob = async (id) => {
    try {
      await fetch(`${API}/api/schedule/${id}`, { method: 'DELETE' });
      fetchJobs();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="module-container fade-in">
      <div className="module-header">
        <div>
          <h2 className="module-title">Schedule Jobs</h2>
          <p className="module-subtitle">Upload your batch files and set them to send automatically.</p>
        </div>
      </div>

      <div className="layout-grid" style={{ gridTemplateColumns: '350px 1fr' }}>
        {/* Left: Schedule Form */}
        <div className="panel">
          <h3 className="panel-title" style={{ marginBottom: 15 }}>Create New Job</h3>
          <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>Campaign Type</label>
              <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
                <option value="email">AutoMail (Email)</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>Upload Batch CSV</label>
              <input 
                type="file" 
                accept=".csv,.xlsx"
                className="form-input" 
                style={{ padding: '8px' }}
                onChange={e => setFile(e.target.files[0])}
                ref={fileInputRef}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}><Calendar size={13} style={{verticalAlign: 'middle', marginRight: 4}}/> Date</label>
                <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}><Clock size={13} style={{verticalAlign: 'middle', marginRight: 4}}/> Time</label>
                <input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} required />
              </div>
            </div>

            {type === 'email' && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>Email Subject</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Subject..."
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>Message Body</label>
              <textarea 
                className="form-textarea" 
                placeholder="Type your message here. Use {ColumnName} to personalize..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              <Play size={16} />
              {loading ? 'Scheduling...' : 'Schedule Job'}
            </button>

            {status && (
              <div className={`status-banner ${status.includes('Error') ? 'error' : 'success'}`} style={{ marginTop: 10 }}>
                <AlertCircle size={16} />
                <span>{status}</span>
              </div>
            )}
          </form>
        </div>

        {/* Right: Upcoming Jobs */}
        <div className="panel">
          <h3 className="panel-title" style={{ marginBottom: 15 }}>Upcoming & Running Jobs</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scheduledJobs.length === 0 ? (
              <div className="empty-state">
                <Calendar size={40} color="#cbd5e1" style={{ marginBottom: 10 }} />
                <p>No upcoming jobs scheduled.</p>
              </div>
            ) : (
              scheduledJobs.map((job) => (
                <div key={job.id} style={{ padding: 15, border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    <div style={{ padding: 10, background: job.type === 'email' ? '#e0f2fe' : '#dcfce7', color: job.type === 'email' ? '#0284c7' : '#16a34a', borderRadius: '50%' }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {job.type === 'email' ? 'AutoMail Batch' : 'WhatsApp Batch'}
                        <span className={`status-badge ${job.status}`}>{job.status}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                        <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4, display: 'inline' }} />
                        Scheduled for: {new Date(job.target_datetime).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {job.status === 'pending' && (
                    <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => deleteJob(job.id)}>
                      <X size={14} /> Cancel
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/admin/Navbar';
import { suppliersAPI } from '../../utils/api';
import { BsPlusLg, BsPencil, BsTrash } from 'react-icons/bs';
import '../../styles/Admin.css'; 

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '', contact_person: '', email: '', phone: '', address: '', status: 'Active'
  });
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await suppliersAPI.getAll();
      setSuppliers(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        await suppliersAPI.update(selectedId, formData);
      } else {
        await suppliersAPI.create(formData);
      }
      fetchSuppliers();
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      alert('Operation failed: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure?')) {
      await suppliersAPI.delete(id);
      fetchSuppliers();
    }
  };

  const openAdd = () => {
    resetForm();
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const openEdit = (supplier) => {
    setFormData(supplier);
    setSelectedId(supplier.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', contact_person: '', email: '', phone: '', address: '', status: 'Active' });
    setSelectedId(null);
  };

  return (
    <div className="admin-layout">
      <Navbar />
      <main className="admin-main">
        <div className="admin-container">
          <div className="page-header">
            <h1 className="page-title">Supplier Management</h1>
            <p className="page-subtitle">Manage your list of suppliers and sources</p>
          </div>

          <div className="card">
            <div className="card-header-action">
              <h2>All Suppliers</h2>
              <button className="btn btn-primary" onClick={openAdd}>
                <BsPlusLg /> Add Supplier
              </button>
            </div>
            
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Contact Person</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan="6">Loading...</td></tr> : suppliers.map(s => (
                    <tr key={s.id}>
                      <td>{s.supplier_id}</td>
                      <td>{s.name}</td>
                      <td>{s.contact_person}</td>
                      <td>{s.phone}</td>
                      <td><span className={`status-badge ${s.status?.toLowerCase()}`}>{s.status}</span></td>
                      <td>
                        <div style={{display: 'flex', gap: '5px'}}>
                            <button className="btn btn-outline btn-small" onClick={() => openEdit(s)}><BsPencil /></button>
                            <button className="btn btn-danger btn-small" onClick={() => handleDelete(s.id)}><BsTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditMode ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Supplier Name *</label>
                <input required className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Contact Person</label>
                <input className="form-input" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-input" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea className="form-textarea" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="save-btn">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
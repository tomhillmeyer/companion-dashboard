import { useState } from 'react';
import type { BoxData } from './App';
import './BoxSettingsModal.css';

interface BoxSettingsModalProps {
    boxData: BoxData;
    onSave: (boxData: BoxData) => void;
    onCancel: () => void;
    onDelete: (boxId: string) => void;
}

export default function BoxSettingsModal({ boxData, onSave, onCancel, onDelete }: BoxSettingsModalProps) {
    const [formData, setFormData] = useState(boxData);

    const handleSave = () => {
        onSave(formData);
    };

    const handleDelete = () => {
        onDelete(boxData.id); // Use boxData.id
    };

    const updateField = (field: keyof BoxData, value: any) => {
        setFormData({ ...formData, [field]: value });
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="settings-section"
                    style={{
                        width: '100%',
                    }}>
                    <label>
                        <span className='setting-header'>Background Color</span>
                        <input
                            type="color"
                            value={formData.backgroundColor}
                            onChange={(e) => updateField('backgroundColor', e.target.value)}
                        />
                        <input
                            type="text"
                            value={formData.backgroundColorText}
                            onChange={(e) => updateField('backgroundColorText', e.target.value)}
                            placeholder='Companion Variable or HEX'
                        />
                    </label>
                </div>
                <div className="settings-section"
                    style={{
                        width: '100%',
                    }}>
                    <div className='setting-group'>
                        <label style={{ flexGrow: '1' }}>
                            <input
                                type="text"
                                value={formData.headerLabelSource}
                                onChange={(e) => updateField('headerLabelSource', e.target.value)}
                            />
                        </label>

                    </div>
                    <div className='setting-group'>
                        <label>
                            <span className='setting-header'>Background Color</span>
                            <input
                                type="color"
                                value={formData.headerColor}
                                onChange={(e) => updateField('headerColor', e.target.value)}
                            />
                            <input
                                type="text"
                                value={formData.headerColorText}
                                onChange={(e) => updateField('headerColorText', e.target.value)}
                                placeholder='Companion Variable or HEX'
                            />
                        </label>
                        <label>
                            <span className='setting-header'>Size</span>
                            <input
                                type="number"
                                value={formData.headerLabelSize}
                                onChange={(e) => updateField('headerLabelSize', parseInt(e.target.value) || 12)}
                                min="8"
                                max="72"
                            />
                        </label>

                        <label>
                            <span className='setting-header'>Text Color</span>

                            <input
                                type="color"
                                value={formData.headerLabelColor}
                                onChange={(e) => updateField('headerLabelColor', e.target.value)}
                            />
                            <input
                                type="text"
                                value={formData.headerLabelColorText}
                                onChange={(e) => updateField('headerLabelColorText', e.target.value)}
                                placeholder='Companion Variable or HEX'
                            />
                        </label>


                    </div>
                    <div className='setting-group'>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.headerLabelBold}
                                onChange={(e) => updateField('headerLabelBold', e.target.checked)}
                            />
                            <span className='setting-header'>Bold</span>

                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.headerLabelVisible}
                                onChange={(e) => updateField('headerLabelVisible', e.target.checked)}
                            />
                            <span className='setting-header'>Visible</span>

                        </label>
                    </div>
                </div>

                {/* Left Label Section */}
                <div className="settings-section" style={{
                    width: '40%',
                }}>
                    <label>
                        <input
                            type="text"
                            value={formData.leftLabelSource}
                            onChange={(e) => updateField('leftLabelSource', e.target.value)}
                        />
                    </label>
                    <div className='setting-group'>

                        <label>
                            <span className='setting-header'>Size</span>

                            <input
                                type="number"
                                value={formData.leftLabelSize}
                                onChange={(e) => updateField('leftLabelSize', parseInt(e.target.value) || 12)}
                                min="8"
                                max="72"
                            />
                        </label>

                        <label>
                            <span className='setting-header'>Color</span>

                            <input
                                type="color"
                                value={formData.leftLabelColor}
                                onChange={(e) => updateField('leftLabelColor', e.target.value)}
                            />
                            <input
                                type="text"
                                value={formData.leftLabelColorText}
                                onChange={(e) => updateField('leftLabelColorText', e.target.value)}
                                placeholder='Companion Variable or HEX'
                            />
                        </label>

                    </div>
                    <div className='setting-group'>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.leftLabelBold}
                                onChange={(e) => updateField('leftLabelBold', e.target.checked)}
                            />
                            <span className='setting-header'>Bold</span>

                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.leftVisible}
                                onChange={(e) => updateField('leftVisible', e.target.checked)}
                            />
                            <span className='setting-header'>Visible</span>

                        </label>
                    </div>
                </div>
                {/* Right Label Section */}
                <div className="settings-section" style={{
                    width: '40%',
                }}>

                    <label>
                        <input
                            type="text"
                            value={formData.rightLabelSource}
                            onChange={(e) => updateField('rightLabelSource', e.target.value)}
                        />
                    </label>
                    <div className='setting-group'>
                        <label>
                            <span className='setting-header'>Size</span>

                            <input
                                type="number"
                                value={formData.rightLabelSize}
                                onChange={(e) => updateField('rightLabelSize', parseInt(e.target.value) || 12)}
                                min="8"
                                max="72"
                            />
                        </label>

                        <label>
                            <span className='setting-header'>Color</span>

                            <input
                                type="color"
                                value={formData.rightLabelColor}
                                onChange={(e) => updateField('rightLabelColor', e.target.value)}
                            />
                            <input
                                type="text"
                                value={formData.rightLabelColorText}
                                onChange={(e) => updateField('rightLabelColorText', e.target.value)}
                                placeholder='Companion Variable or HEX'
                            />
                        </label>

                    </div>
                    <div className='setting-group'>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.rightLabelBold}
                                onChange={(e) => updateField('rightLabelBold', e.target.checked)}
                            />
                            <span className='setting-header'>Bold</span>

                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.rightVisible}
                                onChange={(e) => updateField('rightVisible', e.target.checked)}
                            />
                            <span className='setting-header'>Visible</span>

                        </label>
                    </div>
                </div>

                <div className="modal-buttons">
                    <button onClick={handleSave} className="modal-save-button">Save</button>
                    <button onClick={onCancel} className="modal-cancel-button">Cancel</button>
                    <button onClick={handleDelete} className="modal-delete-button">Delete</button>
                </div>
            </div>
        </div >
    );
}
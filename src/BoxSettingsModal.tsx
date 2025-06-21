import { useState } from 'react';
import type { BoxData, VariableColor } from './App';
import { v4 as uuid } from 'uuid';
import './BoxSettingsModal.css';

import { FaCirclePlus } from "react-icons/fa6";
import { FaCircleMinus } from "react-icons/fa6";


interface BoxSettingsModalProps {
    boxData: BoxData;
    onSave: (boxData: BoxData) => void;
    onCancel: () => void;
    onDelete: (boxId: string) => void;
    onDuplicate: (boxData: BoxData) => void;
}

type SettingSection = 'background' | 'header' | 'left' | 'right';

export default function BoxSettingsModal({ boxData, onSave, onCancel, onDelete, onDuplicate }: BoxSettingsModalProps) {
    const [formData, setFormData] = useState(boxData);
    const [activeSection, setActiveSection] = useState<SettingSection>('background');

    const handleSave = () => {
        onSave(formData);
    };

    const handleDelete = () => {
        onDelete(boxData.id);
    };

    const updateField = (field: keyof BoxData, value: any) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleNumberInput = (field: keyof BoxData, value: string) => {
        if (value === '' || /^\d*$/.test(value)) {
            setFormData({ ...formData, [field]: value });
        }
    };

    const handleNumberBlur = (field: keyof BoxData, value: string) => {
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
            setFormData({ ...formData, [field]: 12 });
        } else {
            setFormData({ ...formData, [field]: numValue });
        }
    };

    const handleDuplicate = () => {
        onDuplicate(formData);
    };

    const addVariableColor = (field: keyof BoxData) => {
        const variableColors = (formData[field] as VariableColor[]) || [];
        const newVariableColor: VariableColor = {
            id: uuid(),
            variable: '',
            value: '',
            color: '#ffffff'
        };
        updateField(field, [...variableColors, newVariableColor]);
    };

    const removeVariableColor = (field: keyof BoxData, id: string) => {
        const variableColors = (formData[field] as VariableColor[]) || [];
        updateField(field, variableColors.filter(vc => vc.id !== id));
    };

    const updateVariableColor = (field: keyof BoxData, id: string, property: keyof VariableColor, value: string) => {
        const variableColors = (formData[field] as VariableColor[]) || [];
        const updated = variableColors.map(vc =>
            vc.id === id ? { ...vc, [property]: value } : vc
        );
        updateField(field, updated);
    };

    const renderVariableColorSection = (title: string, field: keyof BoxData) => {
        const variableColors = (formData[field] as VariableColor[]) || [];

        return (
            <div className="setting-row">
                <div className="setting-label">
                    <span className="setting-header">{title}</span>
                    <div className="variable-color-section">
                        {variableColors.map(vc => (
                            <div key={vc.id} className="variable-color-row">
                                <input
                                    type="text"
                                    value={vc.variable}
                                    onChange={(e) => updateVariableColor(field, vc.id, 'variable', e.target.value)}
                                    placeholder="Variable"
                                    className="variable-input"
                                />
                                <input
                                    type="text"
                                    value={vc.value}
                                    onChange={(e) => updateVariableColor(field, vc.id, 'value', e.target.value)}
                                    placeholder="Value"
                                    className="value-input"
                                />
                                <input
                                    type="color"
                                    value={vc.color}
                                    onChange={(e) => updateVariableColor(field, vc.id, 'color', e.target.value)}
                                    className="color-picker"
                                />
                                <button
                                    type="button"
                                    className="remove-variable-color-button"
                                    onClick={() => removeVariableColor(field, vc.id)}
                                >
                                    <FaCircleMinus />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="add-variable-color-button"
                        onClick={() => addVariableColor(field)}
                    >
                        <FaCirclePlus />
                    </button>
                </div>
            </div>
        );
    };

    const renderBackgroundSettings = () => (
        <div className="settings-section">
            <div className="setting-title">Background</div>
            <div className="setting-group">
                <div className='setting-container'>

                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Background Color</span>
                            <div className="color-input-group">
                                <input
                                    type="color"
                                    value={formData.backgroundColor}
                                    onChange={(e) => updateField('backgroundColor', e.target.value)}
                                />
                                <input
                                    type="text"
                                    value={formData.backgroundColorText}
                                    onChange={(e) => updateField('backgroundColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>
                    {renderVariableColorSection('Variable Background Color', 'backgroundVariableColors')}
                </div>
            </div>
        </div>
    );

    const renderHeaderSettings = () => (
        <div className="settings-section">
            <div className="setting-title">Header</div>
            <div className="setting-group">
                <div className="setting-row">
                    <div className="setting-label">
                        <span className="setting-header">Header Text</span>
                        <input
                            type="text"
                            value={formData.headerLabelSource}
                            onChange={(e) => updateField('headerLabelSource', e.target.value)}
                            className="full-width-input"
                        />
                    </div>
                </div>
                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Font Size</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={formData.headerLabelSize}
                                onChange={(e) => handleNumberInput('headerLabelSize', e.target.value)}
                                onBlur={(e) => handleNumberBlur('headerLabelSize', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="setting-row" style={{ alignSelf: 'flex-end' }}>
                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                id="header-visible"
                                checked={formData.headerLabelVisible}
                                onChange={(e) => updateField('headerLabelVisible', e.target.checked)}
                            />
                            <label htmlFor="header-visible">Visible</label>
                        </div>
                    </div>
                </div>
                <div className='setting-container'>

                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Text Color</span>
                            <div className="color-input-group">
                                <input
                                    type="color"
                                    value={formData.headerLabelColor}
                                    onChange={(e) => updateField('headerLabelColor', e.target.value)}
                                />
                                <input
                                    type="text"
                                    value={formData.headerLabelColorText}
                                    onChange={(e) => updateField('headerLabelColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>

                    {renderVariableColorSection('Variable Text Color', 'headerLabelVariableColors')}
                </div>

                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Background Color</span>
                            <div className="color-input-group">
                                <input
                                    type="color"
                                    value={formData.headerColor}
                                    onChange={(e) => updateField('headerColor', e.target.value)}
                                />
                                <input
                                    type="text"
                                    value={formData.headerColorText}
                                    onChange={(e) => updateField('headerColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>

                    {renderVariableColorSection('Variable Background Color', 'headerVariableColors')}
                </div>


            </div>
        </div>
    );

    const renderLeftSettings = () => (
        <div className="settings-section">
            <div className="setting-title">Left</div>
            <div className="setting-group">
                <div className="setting-row">
                    <div className="setting-label">
                        <span className="setting-header">Left Text</span>
                        <input
                            type="text"
                            value={formData.leftLabelSource}
                            onChange={(e) => updateField('leftLabelSource', e.target.value)}
                            className="full-width-input"
                        />
                    </div>
                </div>
                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Font Size</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={formData.leftLabelSize}
                                onChange={(e) => handleNumberInput('leftLabelSize', e.target.value)}
                                onBlur={(e) => handleNumberBlur('leftLabelSize', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="setting-row" style={{ alignSelf: 'flex-end' }}>
                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                id="left-visible"
                                checked={formData.leftVisible}
                                onChange={(e) => updateField('leftVisible', e.target.checked)}
                            />
                            <label htmlFor="left-visible">Visible</label>
                        </div>
                    </div>
                </div>

                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Text Color</span>
                            <div className="color-input-group">
                                <input
                                    type="color"
                                    value={formData.leftLabelColor}
                                    onChange={(e) => updateField('leftLabelColor', e.target.value)}
                                />
                                <input
                                    type="text"
                                    value={formData.leftLabelColorText}
                                    onChange={(e) => updateField('leftLabelColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>

                    {renderVariableColorSection('Variable Text Color', 'leftLabelVariableColors')}
                </div>

            </div>
        </div >
    );

    const renderRightSettings = () => (
        <div className="settings-section">
            <div className="setting-title">Right</div>
            <div className="setting-group">
                <div className="setting-row">
                    <div className="setting-label">
                        <span className="setting-header">Right Text</span>
                        <input
                            type="text"
                            value={formData.rightLabelSource}
                            onChange={(e) => updateField('rightLabelSource', e.target.value)}
                            className="full-width-input"
                        />
                    </div>
                </div>
                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Font Size</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={formData.rightLabelSize}
                                onChange={(e) => handleNumberInput('rightLabelSize', e.target.value)}
                                onBlur={(e) => handleNumberBlur('rightLabelSize', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="setting-row" style={{ alignSelf: 'flex-end' }}>
                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                id="right-visible"
                                checked={formData.rightVisible}
                                onChange={(e) => updateField('rightVisible', e.target.checked)}
                            />
                            <label htmlFor="right-visible">Visible</label>
                        </div>
                    </div>
                </div>

                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Text Color</span>
                            <div className="color-input-group">
                                <input
                                    type="color"
                                    value={formData.rightLabelColor}
                                    onChange={(e) => updateField('rightLabelColor', e.target.value)}
                                />
                                <input
                                    type="text"
                                    value={formData.rightLabelColorText}
                                    onChange={(e) => updateField('rightLabelColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>

                    {renderVariableColorSection('Variable Text Color', 'rightLabelVariableColors')}
                </div>

            </div>
        </div>
    );

    const renderActiveSection = () => {
        switch (activeSection) {
            case 'background':
                return renderBackgroundSettings();
            case 'header':
                return renderHeaderSettings();
            case 'left':
                return renderLeftSettings();
            case 'right':
                return renderRightSettings();
            default:
                return renderBackgroundSettings();
        }
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-buttons">
                        <button onClick={handleSave} className="modal-save-button">SAVE</button>
                        <button onClick={onCancel} className="modal-cancel-button">CANCEL</button>
                        <button onClick={handleDuplicate} className="modal-duplicate-button">DUPLICATE</button>
                        <button onClick={handleDelete} className="modal-delete-button">DELETE</button>
                    </div>
                </div>

                <div className="modal-body">
                    <div className="modal-nav">
                        <div
                            className={`nav-item ${activeSection === 'background' ? 'active' : ''}`}
                            onClick={() => setActiveSection('background')}
                        >
                            Background
                        </div>
                        <div
                            className={`nav-item ${activeSection === 'header' ? 'active' : ''}`}
                            onClick={() => setActiveSection('header')}
                        >
                            Header
                        </div>
                        <div
                            className={`nav-item ${activeSection === 'left' ? 'active' : ''}`}
                            onClick={() => setActiveSection('left')}
                        >
                            Left
                        </div>
                        <div
                            className={`nav-item ${activeSection === 'right' ? 'active' : ''}`}
                            onClick={() => setActiveSection('right')}
                        >
                            Right
                        </div>
                    </div>

                    <div className="modal-content-area">
                        {renderActiveSection()}
                    </div>
                </div>
            </div>
        </div>
    );
}
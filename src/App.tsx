import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import Box from './Box.tsx';
import SettingsMenu from './SettingsMenu.tsx';
import './App.css';
import defaultBoxes from './defaultBoxes.json';


const STORAGE_KEY = 'boxes';

export interface BoxData {
    id: string;
    frame: { translate: [number, number]; width: number; height: number };
    backgroundColor: string;
    backgroundColorText: string;
    headerColor: string;
    headerColorText: string;
    headerLabelSource: string;
    headerLabel: string;
    headerLabelSize: number;
    headerLabelColor: string;
    headerLabelColorText: string;
    headerLabelBold: boolean;
    headerLabelVisible: boolean;
    leftLabelSource: string;
    leftLabel: string;
    leftLabelSize: number;
    leftLabelColor: string;
    leftLabelColorText: string;
    leftLabelBold: boolean;
    leftVisible: boolean;
    rightLabelSource: string;
    rightLabel: string;
    rightLabelSize: number;
    rightLabelColor: string;
    rightLabelColorText: string;
    rightLabelBold: boolean;
    rightVisible: boolean;
}





export default function App() {
    // Initialize state with localStorage data immediately
    const [boxes, setBoxes] = useState<BoxData[]>(() => {
        const savedBoxes = localStorage.getItem(STORAGE_KEY);
        if (savedBoxes) {
            try {
                return JSON.parse(savedBoxes);
            } catch (error) {
                console.error('Failed to parse saved boxes:', error);
                return defaultBoxes;
            }
        } else {
            return defaultBoxes;
        }
    });


    const handleConfigRestore = (newBoxes: BoxData[], newConnectionUrl: string) => {
        setBoxes(newBoxes);
        setCompanionBaseUrl(newConnectionUrl);
        setSelectedBoxId(null); // Clear any selection
    };

    const deleteAllBoxes = () => {
        setBoxes([]);
        setSelectedBoxId(null); // Clear any selection
    };


    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
    const [companionBaseUrl, setCompanionBaseUrl] = useState<string>('');

    // Save boxes to localStorage whenever boxes state changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
    }, [boxes]);

    const createNewBox = () => {
        const newBox: BoxData = {
            id: uuid(),
            frame: {
                translate: [100, 100] as [number, number],
                width: 200,
                height: 100,
            },
            backgroundColor: "#262626",
            backgroundColorText: "",
            headerColor: '#C93E37',
            headerColorText: "",
            headerLabelSource: 'Time of Day',
            headerLabel: 'NO CONNECTION',
            headerLabelSize: 16,
            headerLabelColor: '#ffffff',
            headerLabelColorText: "",
            headerLabelBold: true,
            leftLabelSource: 'Time',
            leftLabel: '',
            leftLabelSize: 14,
            leftLabelColor: '#FFFFFF',
            leftLabelColorText: "",
            leftLabelBold: false,
            leftVisible: true,
            rightLabelSource: '$(internal:time_hms_12)',
            rightLabel: '',
            rightLabelSize: 20,
            rightLabelColor: '#FFFFFF',
            rightLabelColorText: "",
            rightLabelBold: true,
            rightVisible: true,
            headerLabelVisible: true,
        };
        setBoxes((prev) => [...prev, newBox]);
    };

    /* Function to update a specific box's frame
    const updateBoxFrame = (boxId: string, newFrame: { translate: [number, number]; width: number; height: number }) => {
        setBoxes((prev) =>
            prev.map((box) =>
                box.id === boxId
                    ? { ...box, frame: newFrame }
                    : box
            )
        );
    };*/

    return (
        <div>
            <SettingsMenu
                onNewBox={createNewBox}
                connectionUrl={companionBaseUrl}
                onConnectionUrlChange={setCompanionBaseUrl}
                onConfigRestore={handleConfigRestore}
                onDeleteAllBoxes={deleteAllBoxes}
            />
            {boxes.map((box) => (
                <Box
                    key={box.id}
                    boxData={box}
                    isSelected={selectedBoxId === box.id} // Pass down selection state
                    onSelect={() => setSelectedBoxId(box.id)} // Pass down select handler
                    onDeselect={() => setSelectedBoxId(null)} // Pass down deselect handler
                    onBoxUpdate={(updatedBox) => {
                        setBoxes(prev => prev.map(b => b.id === updatedBox.id ? updatedBox : b));
                    }}
                    onDelete={(boxId) => {
                        setBoxes((prev) => prev.filter((b) => b.id !== boxId));
                        setSelectedBoxId(null);
                    }}
                    companionBaseUrl={companionBaseUrl}
                />
            ))}
        </div>
    );
}


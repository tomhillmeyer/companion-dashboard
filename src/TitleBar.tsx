import { useEffect, useState } from 'react';
import './TitleBar.css';

export const TitleBar = () => {
    const [visible, setVisible] = useState(false);
    const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);

    const showBar = () => {
        setVisible(true);
        if (hideTimeout) clearTimeout(hideTimeout);
        const timeout = setTimeout(() => setVisible(false), 2000);
        setHideTimeout(timeout);
    };

    useEffect(() => {
        const handleMouseMove = () => showBar();
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div className={`title-bar ${visible ? 'visible' : ''}`}>
        </div>
    );
};

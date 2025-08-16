export const getOptimalPopupPosition = (circleRect, popupWidth = 100) => {
    const { innerWidth, innerHeight } = window;
    const spacing = 8;

    const positions = [
        { top: circleRect.top, left: circleRect.right + spacing },
        { top: circleRect.top, left: circleRect.left - popupWidth - spacing },
        { top: circleRect.bottom + spacing, left: circleRect.left },
        { top: circleRect.top - popupWidth - spacing, left: circleRect.left },
    ];

    return positions.find(pos =>
        pos.left >= 0 &&
        pos.left + popupWidth <= innerWidth &&
        pos.top >= 0 &&
        pos.top + 100 <= innerHeight
    ) || positions[0];
};

'use strict';

function getTodayKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${month}-${day}`;
}

function getBirthdayKey(dateOfBirth) {
    if (!dateOfBirth || typeof dateOfBirth !== 'string') return null;

    const parts = dateOfBirth.split('-');

    if (parts.length !== 3) return null;

    return `${parts[1]}-${parts[2]}`;
}

function getAge(person) {
    if (person.isBaby) return null;
    if (!person.dateOfBirth) return null;

    const today = new Date();
    const birthDate = new Date(person.dateOfBirth);

    if (Number.isNaN(birthDate.getTime())) return null;

    let age = today.getFullYear() - birthDate.getFullYear();

    const hasHadBirthday =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

    if (!hasHadBirthday) age--;

    return age;
}

module.exports = {
    async getBirthdaysToday({ homey }) {
        const persons = homey.settings.get('persons') || [];
        const todayKey = getTodayKey();

        const birthdays = Array.isArray(persons)
            ? persons
                .filter((person) => getBirthdayKey(person.dateOfBirth) === todayKey)
                .map((person) => ({
                    name: person.name || '',
                    category: person.category || '',
                    message: person.message || '',
                    imageUrl: person.imageUrl || 'https://raw.githubusercontent.com/LRvdLinden/Homey_Brands/main/Birthdays/birthday_card.png',
                    age: getAge(person),
                    isBaby: !!person.isBaby,
                }))
            : [];

        return {
            date: todayKey,
            birthdays,
        };
    },
};
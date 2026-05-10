'use strict';

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

function getDaysUntilThisYear(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);

    const birthdayThisYear = new Date(
        today.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate()
    );

    today.setHours(0, 0, 0, 0);
    birthdayThisYear.setHours(0, 0, 0, 0);

    return Math.round((birthdayThisYear - today) / (1000 * 60 * 60 * 24));
}

module.exports = {
    async getBirthdaysThisMonth({ homey }) {
        const persons = homey.settings.get('persons') || [];
        const now = new Date();
        const currentMonth = now.getMonth();

        const birthdays = Array.isArray(persons)
            ? persons
                .filter((person) => {
                    if (!person.dateOfBirth) return false;

                    const date = new Date(person.dateOfBirth);
                    if (Number.isNaN(date.getTime())) return false;

                    return date.getMonth() === currentMonth;
                })
                .map((person) => {
                    const date = new Date(person.dateOfBirth);

                    return {
                        name: person.name || '',
                        category: person.category || '',
                        message: person.message || '',
                        imageUrl: person.imageUrl || 'https://raw.githubusercontent.com/LRvdLinden/Homey_Brands/main/Birthdays/birthday_card.png',
                        dateOfBirth: person.dateOfBirth,
                        day: date.getDate(),
                        age: getAge(person),
                        isBaby: !!person.isBaby,
                        daysUntil: getDaysUntilThisYear(person.dateOfBirth),
                    };
                })
                .sort((a, b) => a.day - b.day)
            : [];

        return {
            month: now.toLocaleString('nl-NL', { month: 'long' }),
            birthdays,
        };
    },
};
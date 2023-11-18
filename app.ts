import Homey, { FlowCard, FlowCardCondition, FlowCardTrigger, FlowToken } from "homey";
import * as crypto from "crypto";

const axios = require("axios");

interface Person {
  id: string;
  name: string;
  dateOfBirth: string;
  year?: string;
  mobile?: string;
  mobile2?: string;
  message?: string;
  category?: string;
  imageUrl?: string;
}

interface BirthdayTodayTriggerArgs {
  run_at: string;
}

interface SpecificBirthdayTodayTriggerArgs extends BirthdayTodayTriggerArgs {
  person: Person;
}

interface SpecificBirthdayTodayTriggerState {
  person: Person;
}

interface IsSpecificBirthdayTodayConditionArgs {
  person: Person;
}

interface CategoryBirthdayTriggerArgs {
  run_at: string;
  category: {
    id: string;
    name: string;
  };
}

interface CategoryBirthdayTriggerState {
  person: Person;
}

interface Tokens {
  name: FlowToken;
  mobile: FlowToken;
  mobile2: FlowToken;
  message: FlowToken;
  age: FlowToken;
  imageUrl: FlowToken;
  category: FlowToken;
}

class Birthdays extends Homey.App {
  get image(): any {
    return this._image;
  }

  set image(value: any) {
    this._image = value;
  }

  // private birthdays?: Birthday[];
  private persons?: Array<Person>;
  private tokens?: Tokens;
  private birthdayTriggerCard?: FlowCardTrigger;
  private specificBirthdayTriggerCard?: FlowCardTrigger;
  private categoryBirthdayTriggerCard?: FlowCardTrigger;
  private isBirthdayTodayConditionCard?: FlowCardCondition;
  private isSpecificBirthdayTodayConditionCard?: FlowCardCondition;
  private _image: any;
  private debug: boolean = false;


  async onInit() {
    this.log("Birthdays has been initialized");

    this.sendNotifications();
  }

  async sendNotifications() {
      try {
           const ntfy2023111801 = `[Birthdays 🎉] (1/2) - When you have problems sending out birthday reminders etc...`;
           const ntfy2023111802 = `[Birthdays 🎉] (2/2) - Then make sure no settings field contains the word "Undefined". Delete the word and save again.`;

           await this.homey.notifications.createNotification({
               excerpt: ntfy2023111802
           });

           await this.homey.notifications.createNotification({
               excerpt: ntfy2023111801
           });
      } catch (error) {
          this.log('sendNotifications - error', console.error());
      }
  
    await this.initializeBirthdays();

    this.registerTriggerCard();


    // Check birthdays upon initialization
    await this.checkBirthdayTriggers();

    // Checks triggers every minute
    this.homey.setInterval(this.checkBirthdayTriggers.bind(this), 60 * 1000);


// Maak globale tokens aan
    this.tokens = {
      name: await this.homey.flow.createToken("name", {
        type: "string",
        title: "Name",
        value: "Default Name"
      }),
      mobile: await this.homey.flow.createToken("mobile", {
        type: "string",
        title: "Mobile",
        value: "Default Mobile"
      }),
      mobile2: await this.homey.flow.createToken("mobile2", {
        type: "string",
        title: "Mobile2",
        value: "Empty field"
      }),
      message: await this.homey.flow.createToken("message", {
        type: "string",
        title: "Message",
        value: "Happy Birthday!"
      }),
      age: await this.homey.flow.createToken("age", {
        type: "number",
        title: "Age",
        value: 0
      }),
      imageUrl: await this.homey.flow.createToken("imageUrl", {
        type: "string",
        title: "URL Image",
        value: "Https://"
      }),
      category: await this.homey.flow.createToken("category", {
        type: "string",
        title: "Category",
        value: "Work"
      })
    };
  }

  private async migrateBirthdaysToPersonsSetting(): Promise<void> {
    if (this.homey.settings.get("persons") !== null) {
      this.log("Birthdays have been migrated to persons");
      return;
    }

    try {
      let birthdays = await this.homey.settings.get("birthdays") as Array<{
        name: string,
        date?: string,
        dateOfBirth?: string,
        year?: string,
        mobile: string,
        mobile2: string,
        message: string,
        imageUrl: string,
        category: string,
      }>;

      const mappedBirthdays = birthdays.map((birthday) => {
        return {
          id: this.getUniqueId(birthday),
          name: birthday.name,
          dateOfBirth: birthday.date || birthday.dateOfBirth,
          year: birthday.year,
          mobile: birthday.mobile,
          mobile2: birthday.mobile2,
          message: birthday.message,
          imageUrl: birthday.imageUrl,
          category: birthday.category
        } as Person;
      });

      if (this.debug) {
        this.log("birthdays to migrate:", birthdays);
        this.log("mapped birthdays:", mappedBirthdays);
      }

      this.homey.settings.set("persons", mappedBirthdays);
    } catch (error) {
      this.log("Error fetching birthdays:", error);
    }
  }

  private async fetchBirthdays(): Promise<void> {
    try {
      this.persons = await this.homey.settings.get("persons") as Array<Person>;
      await this.logCompleteBirthdayList();
    } catch (error) {
      this.log("Error fetching birthdays:", error);
    }
  }

  private async initializeBirthdays(): Promise<void> {
    await this.migrateBirthdaysToPersonsSetting();
    await this.fetchBirthdays();

    this.homey.settings.on("set", async (...args): Promise<void> => {
      if (args[0] === "persons") {
        await this.fetchBirthdays();
      }
    });
  }

  private async logCompleteBirthdayList(): Promise<void> {
    this.persons?.forEach((person) => {
      const age = this.getPersonAge(person); // Gebruik de bestaande functie om de leeftijd te berekenen

      this.log(`Person in list = Name: ${person.name} - Date of birth: ${person.dateOfBirth} - Mobile ${person.mobile} - Mobile 2 ${person.mobile} - Age: ${age} - Message: ${person.message}`);
    });
  }


  private isValidTriggerData(data: any): boolean {
    return (
      typeof data.name === "string" &&
      typeof data.mobile === "string" &&
      typeof data.mobile2 === "string" &&
      typeof data.message === "string" &&
      typeof data.age === "number" &&
      typeof data.imageUrl === "string" &&
      typeof data.category === "string"
    );
  }

  private getPersonsWithBirthdaysToday(): Array<Person> {
    return this.persons?.filter((person: Person) => {
      const today = new Date();
      const formattedToday = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      return person.dateOfBirth && person.dateOfBirth.substring(5) === formattedToday;
    }) ?? [];
  };

  private getAvailableCategories(): Array<string> {
    const categories = new Set<string>();

    this.persons?.forEach((person: Person) => {
      if (person.category && person.category.trim() !== "") {
        categories.add(person.category.trim());
      }
    });

    return Array.from(categories);
  };

  private async checkBirthdayTriggers() {
    this.log("Checking birthdays");

    if (this.debug) {
      this.log("Persons with birthdays today", this.getPersonsWithBirthdaysToday());
    }

    const birthdaysToday = this.getPersonsWithBirthdaysToday();
    for (let i = 0; i < birthdaysToday.length; i++) {
      const birthdayPerson = birthdaysToday[i];
      const tokens = {
        name: birthdayPerson.name,
        age: this.getPersonAge(birthdayPerson),
        mobile: birthdayPerson.mobile,
        mobile2: birthdayPerson.mobile2,
        message: birthdayPerson.message,
        imageUrl: birthdayPerson.imageUrl,
        category: birthdayPerson.category
      };
      const state = {
        person: birthdayPerson
      };

      if (this.debug) {
        this.log("trigger birthday triggers with", { tokens, state });
      }

      this.birthdayTriggerCard?.trigger(tokens, state);
      this.specificBirthdayTriggerCard?.trigger(tokens, state);
      this.categoryBirthdayTriggerCard?.trigger(tokens, state);

      // Update globale tokens
      this.updateGlobalTokens(birthdayPerson);

      // Wacht voor een specifieke tijd voordat je doorgaat naar de volgende jarige persoon
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconden wachten
    }
  }


  // Methode om globale tokens bij te werken
  private async updateGlobalTokens(birthdayPerson: Person): Promise<void> {
    try {
      if (this.tokens && this.tokens.name) {
        await this.tokens.name.setValue(birthdayPerson.name);
      }
      if (this.tokens && this.tokens.mobile) {
        await this.tokens.mobile.setValue(birthdayPerson.mobile || "No mobile");
      }
      if (this.tokens && this.tokens.mobile2) {
        await this.tokens.mobile2.setValue(birthdayPerson.mobile2 || "No mobile");
      }
      if (this.tokens && this.tokens.message) {
        await this.tokens.message.setValue(birthdayPerson.message || "Happy Birthday!");
      }
      if (this.tokens && this.tokens.imageUrl) {
        await this.tokens.imageUrl.setValue(birthdayPerson.imageUrl || "Https://");
      }
      if (this.tokens && this.tokens.category) {
        await this.tokens.category.setValue(birthdayPerson.category || "Work");
      }
      if (this.tokens && this.tokens.age) {
        const age = this.getPersonAge(birthdayPerson);
        await this.tokens.age.setValue(Number(age));
      }
    } catch (error) {
      this.log("Error updating global tokens", error);
    }
  }

  private registerTriggerCard() {
    // Birthday trigger card
    this.birthdayTriggerCard = this.homey.flow.getTriggerCard("birthday-today");
    this.birthdayTriggerCard.registerRunListener(async (args: BirthdayTodayTriggerArgs, state) => {
      // Validate that the current time matches the args.run_at time which has the format "HH:mm"
      return this.verifyRunAtByArgs(args);
    });

    // Specific person birthday trigger card
    this.specificBirthdayTriggerCard = this.homey.flow.getTriggerCard("specific-birthday-today");
    this.specificBirthdayTriggerCard.registerRunListener(async (args: SpecificBirthdayTodayTriggerArgs, state: SpecificBirthdayTodayTriggerState) => {
      // Validate that the current time matches the args.run_at time which has the format "HH:mm" and verify that the person is the same
      return this.isSamePerson(args.person, state.person) && this.verifyRunAtByArgs(args);
    });
    this.specificBirthdayTriggerCard.registerArgumentAutocompleteListener("person", this.autocompletePersons.bind(this));

    // Category birthday trigger card
    this.categoryBirthdayTriggerCard = this.homey.flow.getTriggerCard("category-birthday-today");
    this.categoryBirthdayTriggerCard.registerRunListener(async (args: CategoryBirthdayTriggerArgs, state: CategoryBirthdayTriggerState) => {
      // Validate that the current time matches the args.run_at time which has the format "HH:mm" and verify that the person belongs to the provided category
      return String(args.category.id).toLowerCase() === String(state.person.category).toLowerCase()
        && this.verifyRunAtByArgs(args);
    });
    this.categoryBirthdayTriggerCard.registerArgumentAutocompleteListener("category", this.autocompleteCategories.bind(this));

    // Is birthday condition card
    this.isBirthdayTodayConditionCard = this.homey.flow.getConditionCard("is-birthday-today");
    this.isBirthdayTodayConditionCard.registerRunListener(async (args, state) => {
      return this.getPersonsWithBirthdaysToday().length > 0;
    });

    // Is specific person birthday condition card
    this.isSpecificBirthdayTodayConditionCard = this.homey.flow.getConditionCard("is-specific-birthday-today");
    this.isSpecificBirthdayTodayConditionCard.registerRunListener(async (args: IsSpecificBirthdayTodayConditionArgs) => {
      const person = this.findPersonById(args.person.id);

      return this.isPersonsBirthday(person);
    });
    this.isSpecificBirthdayTodayConditionCard.registerArgumentAutocompleteListener("person", this.autocompletePersons.bind(this));

    this.homey.flow.getActionCard("temporary-image").registerRunListener(this.temporaryImageRunListener.bind(this));
  }

  private async temporaryImageRunListener(args: { imageUrl: string }) {
    const { imageUrl } = args;

    try {
      this._image = await this.homey.images.createImage();

      await this._image.setStream(async (stream: NodeJS.WritableStream) => {
        const response = await axios.get(imageUrl, { responseType: "stream" });

        if (response.status !== 200) {
          this.error("Error fetching image:", response.statusText);
          throw new Error("Error fetching image");
        }

        response.data.pipe(stream);
      });

      const tokens = {
        image: this._image
      };

      return tokens;
    } catch (error) {
      this.error("Error setting image:", error);
      throw new Error("Error setting image");
    }
  }

  private async autocompletePersons(query: string, args: any): Promise<FlowCard.ArgumentAutocompleteResults> {
    // Return all persons mapped to homey flow card autocomplete items and optionally filtered by the query
    return this.persons
      ?.map((person: Person) => {
        return {
          id: person.id,
          name: person.name
        };
      })
      .filter((result) => {
        return result.name.toLowerCase().includes(query.toLowerCase());
      }) as FlowCard.ArgumentAutocompleteResults;
  }

  private async autocompleteCategories(query: string): Promise<FlowCard.ArgumentAutocompleteResults> {
    // Return all categories mapped to homey flow card autocomplete items and optionally filtered by the query
    return this.getAvailableCategories()
      .map((category) => {
        return {
          id: category, // Of een andere unieke identificatie van de categorie
          name: category
        };
      })
      .filter((result) => {
        return result.name.toLowerCase().includes(query.toLowerCase());
      }) as FlowCard.ArgumentAutocompleteResults;
  }


  private verifyRunAtByArgs(args: BirthdayTodayTriggerArgs) {
    const now = new Date();
    const targetTimezone = this.homey.clock.getTimezone();

    const nowString = now.toLocaleTimeString(this.getLocale(), { timeZone: targetTimezone, hour12: false });
    const [nowHours, nowMinutes] = nowString.split(":").map(Number);
    const [runAtHours, runAtMinutes] = args.run_at.split(":").map(Number);

    if (this.debug) {
      this.log("verify run at", {
        nowHours,
        nowMinutes,
        runAtHours,
        runAtMinutes
      });
    }

    return nowHours === runAtHours &&
      nowMinutes === runAtMinutes;
  }

  private convertTimeToCron(time: string) {
    const [hours, minutes]: [string, string] = time.split(":") as [string, string];

    // Validate hours and minutes
    if (parseInt(hours) < 0 || parseInt(hours) > 23 || parseInt(minutes) < 0 || parseInt(minutes) > 59) {
      throw new Error("Invalid time format. Hours must be between 0 and 23, and minutes must be between 0 and 59.");
    }

    return `${minutes} ${hours} * * *`; // Cron format: "minutes hours * * *"
  }


//  private registerActionCard() {
//    const getNextBirthdayActionCard = this.homey.flow.getActionCard("get-next-birthday");
//
//    getNextBirthdayActionCard.registerRunListener(async (args, state) => {
//      const nextBirthdayPerson = this.getNextBirthdayPerson();
//
//      if (nextBirthdayPerson) {
//        const today = new Date();
//        const age = nextBirthdayPerson.year ? today.getFullYear() - parseInt(nextBirthdayPerson.year) : null;
//
//        const tokens = {
//          name: nextBirthdayPerson.name,
//          mobile: nextBirthdayPerson.mobile,
//          message: nextBirthdayPerson.message,
//          date: nextBirthdayPerson.dateOfBirth,
//          age: age || "0"
//        };
//
//        return tokens;  // returning the tokens will pass them to the card
//      } else {
//        throw new Error("No upcoming birthdays found.");
//      }
//    });
//  }

  private findPersonById(id: string): Person | undefined {
    return this.persons?.find((person: Person) => person.id === id);
  }

  private isPersonsBirthday(person: Person | undefined): boolean {
    return this.getPersonsWithBirthdaysToday().some((birthdayPerson: Person) => this.isSamePerson(birthdayPerson, person));
  }

  private getNextBirthdayPerson(): Person | undefined {
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Sort the birthdays in ascending order of date starting from today
    return this.persons
      ?.sort((personA: Person, personB: Person) => {
        const aDate = new Date(personA.dateOfBirth);
        const bDate = new Date(personB.dateOfBirth);
        return aDate.getUTCSeconds() - bDate.getUTCSeconds();
      })
      ?.find(person => {
        const date = new Date(person.dateOfBirth);
        return date.getUTCSeconds() > today.getUTCSeconds();
      });
  }

  private getUniqueId(object: Object): string {
    const hash = crypto.createHash("sha1");
    hash.update(JSON.stringify(object));
    return hash.digest("hex");
  }

  private getPersonAge(person: Person): number {
    const today = new Date();
    const birthDate = new Date(person.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const month = today.getMonth() - birthDate.getMonth();

    if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  private getLocale(): string {
    const localeMappings: Record<string, string> = {
      en: "en-GB", // English (United Kingdom)
      nl: "nl-NL", // Dutch (Netherlands)
      de: "de-DE", // German (Germany)
      fr: "fr-FR", // French (France)
      it: "it-IT", // Italian (Italy)
      es: "es-ES", // Spanish (Spain)
      sv: "sv-SE", // Swedish (Sweden)
      no: "nb-NO", // Norwegian (Norway)
      da: "da-DK", // Danish (Denmark)
      ru: "ru-RU", // Russian (Russia)
      pl: "pl-PL" // Polish (Poland)
    };

    return localeMappings[this.homey.i18n.getLanguage()] || "en-GB"; // Default to English (United Kingdom) if no mapping is found
  }

  private isSamePerson(personA: Person | undefined, personB: Person | undefined): boolean {
    return personA !== undefined && personB !== undefined && personA?.id === personB?.id;
  }
}

module.exports = Birthdays;


import Homey, { FlowCard, FlowCardTrigger, FlowToken } from "homey";
import * as crypto from "crypto";
const axios = require('axios');

interface Person {
  id: string;
  name: string;
  dateOfBirth: string;
  year?: string;
  mobile?: string;
  message?: string;
  category?: string;
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

interface CategoryBirthdayTriggerArgs {
  run_at: string;
  person: Person;
}

interface CategoryBirthdayTriggerState {
  person: Person;
}

interface Birthday extends Person {
  age: number;
}

interface Tokens {
  name: FlowToken;
  mobile: FlowToken;
  message: FlowToken;
  age: FlowToken;
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
  private _image: any;
  private _imageSet: boolean = false;
  private debug: boolean = false;

  async onInit() {
    this.log("Birthdays has been initialized");
    await this.initializeBirthdays();

    this.registerTriggerCard();
    this.registerActionCard();

    // Check birthdays upon initialization
    await this.checkBirthdayTriggers();

    // Checks triggers every minute
    this.homey.setInterval(this.checkBirthdayTriggers.bind(this), 60 * 1000);

    // this.tokens = {
    //   name: await this.homey.flow.createToken("name", {
    //     type: "string",
    //     title: "Name",
    //     value: "John Doe"
    //   }),
    //
    //   mobile: await this.homey.flow.createToken("mobile", {
    //     type: "string",
    //     title: "Mobile",
    //     value: "0612345678"
    //   }),
    //   message: await this.homey.flow.createToken("message", {
    //     type: "string",
    //     title: "Message",
    //     value: "Happy Birthday!"
    //   }),
    //   age: await this.homey.flow.createToken("age", {
    //     type: "number",
    //     title: "Age",
    //     value: 0
    //   })
    // };
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
        message: string,
      }>;

      const mappedBirthdays = birthdays.map((birthday) => {
        return {
          id: this.getUniqueId(birthday),
          name: birthday.name,
          dateOfBirth: birthday.date || birthday.dateOfBirth,
          year: birthday.year,
          mobile: birthday.mobile,
          message: birthday.message
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

        // TODO: refactor
        // if (this.birthdays) {
        //   await this.notifyBirthdayAdded(this.birthdays[this.birthdays.length - 1]);
        // }
      }
    });
  }

  private async logCompleteBirthdayList(): Promise<void> {
    this.persons?.forEach((person) => {
      const age = person.year ? new Date().getFullYear() - parseInt(person.year) : 0;

      this.log(`Person in list = Name: ${person.name} - Date of birth: ${person.dateOfBirth} - BirthYear: ${person.year} - Age: ${age} - Message: ${person.message}`);
    });
  }

  private isValidTriggerData(data: any): boolean {
    return (
      typeof data.name === "string" &&
      typeof data.mobile === "string" &&
      typeof data.message === "string" &&
      typeof data.age === "number" &&
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

  private async checkBirthdayTriggers() {
    this.log("Checking birthdays");

    if (this.debug) {
      this.log("Persons with birthdays today", this.getPersonsWithBirthdaysToday());
    }
    // Trigger the birthday card every time for each person who has a birthday today
    // the run listener will deal with the run_at time
    this.getPersonsWithBirthdaysToday().forEach((birthdayPerson: Person): void => {
      const tokens = {
        name: birthdayPerson.name,
        age: this.getPersonAge(birthdayPerson),
        mobile: birthdayPerson.mobile,
        message: birthdayPerson.message
      };
      const state = {
        person: birthdayPerson
      };

      if (this.debug) {
        this.log("trigger birthday triggers with", { tokens, state });
      }

      this.birthdayTriggerCard?.trigger(tokens, state);
      this.specificBirthdayTriggerCard?.trigger(tokens, state);
    });
  }

  /**
   * Er moet denk ik met node-cron nog een aparte timer ingesteld worden zodat de app 1 keer per dag per persoon een
   * notificatie op de tijdlijn aan kan maken
   */
  private sendNotifications(birthdayPerson: Birthday): Promise<void> {
    const notificationMessage = this.homey.__("birthday_notification", {
      name: birthdayPerson.name,
      age: birthdayPerson.age
    });

    return this.homey.notifications
      .createNotification({ excerpt: notificationMessage })
      .catch(error => this.log("notifyBirthdayAdded - error", error));
  }

  /**
   * Dit moeten we denk ik a.d.h.v. een event die je vanuit de settings pagina emit gaan doen
   */
  private notifyBirthdayAdded(birthdayPerson: Birthday): Promise<void> {
    const notificationMessage = this.homey.__("messages.person_added", {
      name: birthdayPerson.name,
      age: birthdayPerson.age
    });

    return this.homey.notifications
      .createNotification({ excerpt: notificationMessage })
      .catch(error => this.log("notifyBirthdayAdded - error", error));
  }

  private registerTriggerCard() {
    this.birthdayTriggerCard = this.homey.flow.getTriggerCard("birthday-today");
    this.birthdayTriggerCard.registerRunListener(async (args: BirthdayTodayTriggerArgs, state) => {
      // Validate that the current time matches the args.run_at time which has the format "HH:mm"
      return this.verifyRunAtByArgs(args);
    });

    this.specificBirthdayTriggerCard = this.homey.flow.getTriggerCard("specific-birthday-today");
    this.specificBirthdayTriggerCard.registerRunListener(async (args: SpecificBirthdayTodayTriggerArgs, state: SpecificBirthdayTodayTriggerState) => {
      // Validate that the current time matches the args.run_at time which has the format "HH:mm" and verify that the person is the same
      return this.isSamePerson(args.person, state.person) && this.verifyRunAtByArgs(args);
    });
    this.specificBirthdayTriggerCard.registerArgumentAutocompleteListener(
      "person",
      async (query: string, args) => {
        // map persons to homey flow card autocomplete items
        const results = this.persons?.map((person: Person) => {
          return {
            id: person.id,
            name: person.name
          };
        }) as FlowCard.ArgumentAutocompleteResults ?? [];

        // filter based on the query
        return results.filter((result) => {
          return result.name.toLowerCase().includes(query.toLowerCase());
        });
      }
    );

    this.categoryBirthdayTriggerCard = this.homey.flow.getTriggerCard("category-birthday-today");
    this.categoryBirthdayTriggerCard.registerRunListener(async (args: CategoryBirthdayTriggerArgs, state: CategoryBirthdayTriggerState) => {
        // Hier controleren we eerst of args en state daadwerkelijk de verwachte waarden bevatten
        if(!args.person || !state.person) {
            throw new Error("Expected person details in args and state.");
        }

        // Valideer dat de huidige tijd overeenkomt met de args.run_at tijd die het formaat "HH:mm" heeft en verifieer dat de persoon dezelfde is
        return this.isSamePerson(args.person, state.person) && this.verifyRunAtByArgs(args);
    });

    this.homey.flow.getConditionCard("is-birthday-today").registerRunListener(async (args, state) => {
      const today = new Date();
      const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const birthdayPerson = this.persons?.find(p => p.dateOfBirth.substring(5) === formattedToday.substring(5));
      return !!birthdayPerson;
    });

    this.homey.flow.getActionCard("temporary-image").registerRunListener(async (args, state) => {
      const { imageUrl } = args;

      try {
          if (!this._image) {
              this._imageSet = false;
          }

          this._image = await this.homey.images.createImage();

          await this._image.setStream(async (stream: NodeJS.WritableStream) => {
              const response = await axios.get(imageUrl, { responseType: 'stream' });

              if (response.status !== 200) {
                  this.error('Error fetching image:', response.statusText);
                  throw new Error('Error fetching image');
              }

              response.data.pipe(stream);
          });

          const tokens = {
              image: this._image
          };

          return tokens;
      } catch (error) {
          this.error('Error setting image:', error);
          throw new Error('Error setting image');
      }
  });
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


  private registerActionCard() {
    const getNextBirthdayActionCard = this.homey.flow.getActionCard("get-next-birthday");

    getNextBirthdayActionCard.registerRunListener(async (args, state) => {
      const nextBirthdayPerson = this.getNextBirthdayPerson();

      if (nextBirthdayPerson) {
        const today = new Date();
        const age = nextBirthdayPerson.year ? today.getFullYear() - parseInt(nextBirthdayPerson.year) : null;

        const tokens = {
          name: nextBirthdayPerson.name,
          mobile: nextBirthdayPerson.mobile,
          message: nextBirthdayPerson.message,
          date: nextBirthdayPerson.dateOfBirth,
          age: age || "0"
        };

        return tokens;  // returning the tokens will pass them to the card
      } else {
        throw new Error("No upcoming birthdays found.");
      }
    });
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

  private getPersonAge(person: Person): Number {
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

  private isSamePerson(personA: Person, personB: Person) {
    return personA.id === personB.id;
  }
}

module.exports = Birthdays;

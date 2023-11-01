import Homey, { FlowCard, FlowCardTrigger, FlowToken } from "homey";
import * as crypto from "crypto";

interface Person {
  name: string;
  dateOfBirth: string;
  year?: string;
  mobile: string;
  message: string;
}

interface BirthdayTodayTriggerArgs {
  run_at: string;
}

interface SpecificBirthdayTodayTriggerArgs {
  person: Person;
  run_at: string;
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
  // private birthdays?: Birthday[];
  private persons?: Array<Person>;
  private tokens?: Tokens;
  private birthdayTriggerCard?: FlowCardTrigger;
  private specificBirthdayTriggerCard?: FlowCardTrigger;

  async onInit() {
    this.log("Birthdays has been initialized");
    await this.initializeBirthdays();

    this.registerTriggerCard();
    this.registerActionCard();

    // Check birthdays upon initialization
    await this.checkForTodaysBirthdays();

    // Set up a daily interval to check for birthdays
    this.homey.setInterval(this.checkForTodaysBirthdays.bind(this), 60 * 60 * 1000);

    this.tokens = {
      name: await this.homey.flow.createToken("name", {
        type: "string",
        title: "Name",
        value: "John Doe"
      }),

      mobile: await this.homey.flow.createToken("mobile", {
        type: "string",
        title: "Mobile",
        value: "0612345678"
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
        date: string,
        year?: string,
        mobile: string,
        message: string,
      }>;

      this.homey.settings.set("persons", birthdays.map((birthday) => {
        return {
          name: birthday.name,
          dateOfBirth: birthday.date,
          year: birthday.year,
          mobile: birthday.mobile,
          message: birthday.message
        } as Person;
      }));

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
      console.log("args");
      if (args[0] === "persons") {
        await this.fetchBirthdays();

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
      typeof data.age === "number"
    );
  }

  private async checkForTodaysBirthdays() {
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const lastTriggeredDate = await this.homey.settings.get("lastTriggeredDate") as string;

    if (lastTriggeredDate === formattedToday) {
      this.log("Already triggered the birthday card for today.");
      return;
    }

    // const birthdayPerson = this.persons?.find(p => p.dateOfBirth.substring(5) === formattedToday.substring(5));

    // if (birthdayPerson === undefined) {
    //   this.log("Error: Invalid or missing name for birthday person.", birthdayPerson);
    //   return;
    // }
    //
    // const age = birthdayPerson.year ? today.getFullYear() - parseInt(birthdayPerson.year) : null;
    //
    // if (birthdayPerson && birthdayPerson.name && birthdayPerson.mobile && birthdayPerson.message) {
    //   const triggerData = {
    //     name: birthdayPerson.name,
    //     age: age || 0,
    //     mobile: birthdayPerson.mobile,
    //     message: birthdayPerson.message
    //   };
    //
    //   await this.tokens?.mobile.setValue(triggerData.mobile);
    //   await this.tokens?.message.setValue(triggerData.message);
    //   await this.tokens?.age.setValue(triggerData.age);
    //
    //   Object.entries(triggerData).forEach(([key, value]) => {
    //     if (typeof value === "undefined") {
    //       this.log(`Error: Undefined value detected for key ${key} in triggerData.`);
    //     }
    //   });
    //
    //   if (this.isValidTriggerData(triggerData)) {
    //     this.log("TriggerData before triggering:", triggerData);
    //
    //     this.homey.flow.getTriggerCard("birthday-today").trigger(triggerData).then(() => {
    //       this.homey.settings.set("lastTriggeredDate", formattedToday);
    //     }).catch(error => {
    //       this.log("Error triggering the card:", error);
    //     });
    //   } else {
    //     this.log("Error: Invalid trigger data:", triggerData);
    //   }
    // } else {
    //   this.log("Missing birthday data or today is not a birthday.");
    // }
  }

  private sendNotifications(birthdayPerson: Birthday): Promise<void> {
    const notificationMessage = this.homey.__("birthday_notification", { name: birthdayPerson.name, age: birthdayPerson.age });

    return this.homey.notifications
      .createNotification({ excerpt: notificationMessage })
      .catch(error => this.log("notifyBirthdayAdded - error", error));
  }

  private notifyBirthdayAdded(birthdayPerson: Birthday): Promise<void> {
    const notificationMessage = this.homey.__("messages.person_added", { name: birthdayPerson.name, age: birthdayPerson.age });

    return this.homey.notifications
      .createNotification({ excerpt: notificationMessage })
      .catch(error => this.log("notifyBirthdayAdded - error", error));
  }


  private registerTriggerCard() {
    this.birthdayTriggerCard = this.homey.flow.getTriggerCard("birthday-today");
    this.birthdayTriggerCard.registerRunListener(async (args: BirthdayTodayTriggerArgs, state) => {
      if (this.isValidTriggerData(state)) {
        return true;
      }

      this.log("Error: Invalid trigger state:", state);

      return false;
    });

    this.birthdayTriggerCard.getArgumentValues()
      .then((values: Array<BirthdayTodayTriggerArgs>) => {
        console.log("birthdayTriggerCard.getArgumentValues", values);
      });

    this.specificBirthdayTriggerCard = this.homey.flow.getTriggerCard("specific-birthday-today");
    this.specificBirthdayTriggerCard.registerRunListener(async (args: SpecificBirthdayTodayTriggerArgs, state) => {
      if (this.isValidTriggerData(state)) {
        return true;
      }

      this.log("Error: Invalid trigger state:", state);

      return false;
    });
    this.specificBirthdayTriggerCard.registerArgumentAutocompleteListener(
      "person",
      async (query: string, args) => {
        const results = this.persons?.map((person: Person) => {
          return {
            id: this.getUniqueId(person),
            name: person.name
          };
        }) as FlowCard.ArgumentAutocompleteResults ?? [];

        // filter based on the query
        return results.filter((result) => {
          return result.name.toLowerCase().includes(query.toLowerCase());
        });
      }
    );
    this.specificBirthdayTriggerCard.on('')

    this.homey.flow.getConditionCard("is-birthday-today").registerRunListener(async (args, state) => {
      const today = new Date();
      const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const birthdayPerson = this.persons?.find(p => p.dateOfBirth.substring(5) === formattedToday.substring(5));
      return !!birthdayPerson;
    });

    this.homey.flow.getActionCard("temporary-image").registerRunListener(async (args, state) => {
      // this._image = args.image;
      // this._imageSet = true;
      // setTimeout(() => {
      //   this._imageSet = false;
      // }, 120000);
      // return true;
    });
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
}

module.exports = Birthdays;

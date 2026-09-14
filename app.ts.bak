import Homey, { FlowCard, FlowCardCondition, FlowCardTrigger, FlowToken } from "homey";
import * as crypto from "crypto";

const axios = require("axios");
const { parseIcal, mergeSource } = require('./lib/ical');

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
    await this.sendNotifications();
    await this.syncIcalSources(false);
    this.homey.setInterval(() => this.syncIcalSources(false), 6 * 60 * 60 * 1000);
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
    const tokenTitles: Record<string, Record<string, string>> = {
      name:{en:'Name',nl:'Naam',de:'Name',fr:'Nom',it:'Nome',sv:'Namn',no:'Navn',es:'Nombre',da:'Navn',ru:'Имя',pl:'Imię',ko:'이름',ar:'الاسم'},
      mobile:{en:'Mobile',nl:'Mobiel',de:'Mobilnummer',fr:'Mobile',it:'Cellulare',sv:'Mobil',no:'Mobil',es:'Móvil',da:'Mobil',ru:'Телефон',pl:'Telefon',ko:'휴대폰',ar:'الهاتف المحمول'},
      mobile2:{en:'Mobile 2',nl:'Mobiel 2',de:'Mobilnummer 2',fr:'Mobile 2',it:'Cellulare 2',sv:'Mobil 2',no:'Mobil 2',es:'Móvil 2',da:'Mobil 2',ru:'Телефон 2',pl:'Telefon 2',ko:'휴대폰 2',ar:'الهاتف المحمول 2'},
      message:{en:'Message',nl:'Bericht',de:'Nachricht',fr:'Message',it:'Messaggio',sv:'Meddelande',no:'Melding',es:'Mensaje',da:'Besked',ru:'Сообщение',pl:'Wiadomość',ko:'메시지',ar:'الرسالة'},
      age:{en:'Age',nl:'Leeftijd',de:'Alter',fr:'Âge',it:'Età',sv:'Ålder',no:'Alder',es:'Edad',da:'Alder',ru:'Возраст',pl:'Wiek',ko:'나이',ar:'العمر'},
      imageUrl:{en:'Image URL',nl:'Afbeeldings-URL',de:'Bild-URL',fr:"URL de l’image",it:'URL immagine',sv:'Bild-URL',no:'Bilde-URL',es:'URL de imagen',da:'Billed-URL',ru:'URL изображения',pl:'URL obrazu',ko:'이미지 URL',ar:'رابط الصورة'},
      category:{en:'Category',nl:'Categorie',de:'Kategorie',fr:'Catégorie',it:'Categoria',sv:'Kategori',no:'Kategori',es:'Categoría',da:'Kategori',ru:'Категория',pl:'Kategoria',ko:'카테고리',ar:'الفئة'}
    };
    const language = this.homey.i18n.getLanguage();
    const title = (key: string) => tokenTitles[key][language] || tokenTitles[key].en;
    this.tokens = {
      name: await this.homey.flow.createToken("name", {
        type: "string",
        title: title('name'),
        value: "Default Name"
      }),
      mobile: await this.homey.flow.createToken("mobile", {
        type: "string",
        title: title('mobile'),
        value: "Default Mobile"
      }),
      mobile2: await this.homey.flow.createToken("mobile2", {
        type: "string",
        title: title('mobile2'),
        value: "Empty field"
      }),
      message: await this.homey.flow.createToken("message", {
        type: "string",
        title: title('message'),
        value: "Happy Birthday!"
      }),
      age: await this.homey.flow.createToken("age", {
        type: "number",
        title: title('age'),
        value: 0
      }),
      imageUrl: await this.homey.flow.createToken("imageUrl", {
        type: "string",
        title: title('imageUrl'),
        value: "Https://"
      }),
      category: await this.homey.flow.createToken("category", {
        type: "string",
        title: title('category'),
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
      let birthdays = (await this.homey.settings.get("birthdays") || []) as Array<{
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
      if (args[0] === "icalSources") {
        await this.syncIcalSources(true);
      }
    });
  }

  public async syncIcalSources(manual: boolean = false): Promise<any> {
    const configuredSources = this.homey.settings.get('icalSources') || [];
    const sources = configuredSources.filter((source: any) => source && source.enabled !== false && source.url);
    const syncedAt = new Date().toISOString();
    const status: any = { syncedAt, sources: {} };

    if (!sources.length) {
      await this.homey.settings.set('icalSyncStatus', status);
      return status;
    }

    let persons = this.homey.settings.get('persons') || [];
    for (const source of sources) {
      try {
        const requestUrl = String(source.url).replace(/^webcal:\/\//i, 'https://');
        const response = await axios.get(requestUrl, {
          responseType: 'text',
          timeout: 30000,
          maxContentLength: 5 * 1024 * 1024,
          maxRedirects: 5,
          headers: {
            Accept: 'text/calendar,text/plain;q=0.9,*/*;q=0.5',
            'User-Agent': 'Birthdays-for-Homey/2.1.2',
          },
          transformResponse: [(data: any) => data],
        });
        const calendarText = typeof response.data === 'string' ? response.data : String(response.data || '');
        if (!/BEGIN:(?:VCALENDAR|VEVENT)/i.test(calendarText)) {
          throw new Error('The URL did not return an iCal calendar');
        }
        const imported = parseIcal(calendarText, source.id, source.name || 'iCal');
        persons = mergeSource(persons, imported, source.id);
        status.sources[source.id] = { ok: true, count: imported.length, syncedAt };
      } catch (error: any) {
        status.sources[source.id] = {
          ok: false,
          count: 0,
          syncedAt,
          error: error && error.message ? error.message : String(error),
        };
      }
    }

    await this.homey.settings.set('persons', persons);
    await this.homey.settings.set('icalSyncStatus', status);
    this.persons = persons;
    if (manual) this.log('Manual iCal sync finished', status);
    return status;
  }

  public async importIcalUpload(body: any): Promise<any> {
    const content = String(body.content || '');
    if (!content || content.length > 5 * 1024 * 1024) throw new Error('Invalid or oversized iCal file');
    if (!/BEGIN:(?:VCALENDAR|VEVENT)/i.test(content)) throw new Error('The file is not a valid iCal calendar');
    const sourceId = String(body.sourceId || `upload-${Date.now()}`);
    const sourceName = String(body.name || 'iCal upload');
    const imported = parseIcal(content, sourceId, sourceName);
    const persons = mergeSource(this.homey.settings.get('persons') || [], imported, sourceId);
    await this.homey.settings.set('persons', persons);
    this.persons = persons;
    return { ok: true, count: imported.length, sourceId };
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
    const today = this.getHomeyDateParts();
    const formattedToday = `${today.month}-${today.day}`;
    return this.persons?.filter((person: Person) => {
      return typeof person.dateOfBirth === 'string' && person.dateOfBirth.substring(5) === formattedToday;
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
        name: String(birthdayPerson.name || ''),
        age: Number(this.getPersonAge(birthdayPerson) || 0),
        mobile: String(birthdayPerson.mobile || ''),
        mobile2: String(birthdayPerson.mobile2 || ''),
        message: String(birthdayPerson.message || ''),
        imageUrl: String(birthdayPerson.imageUrl || ''),
        category: String(birthdayPerson.category || '')
      };
      const state = {
        person: birthdayPerson
      };

      if (this.debug) {
        this.log("trigger birthday triggers with", { tokens, state });
      }

      const triggerResults = await Promise.allSettled([
        this.birthdayTriggerCard?.trigger(tokens, state),
        this.specificBirthdayTriggerCard?.trigger(tokens, state),
        this.categoryBirthdayTriggerCard?.trigger(tokens, state)
      ]);
      triggerResults.forEach((result, index) => {
        if (result.status === 'rejected') this.error(`Birthday trigger ${index + 1} failed`, result.reason);
      });

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
      return !!args && typeof args.run_at === 'string' && this.verifyRunAtByArgs(args);
    });

    // Specific person birthday trigger card
    this.specificBirthdayTriggerCard = this.homey.flow.getTriggerCard("specific-birthday-today");
    this.specificBirthdayTriggerCard.registerRunListener(async (args: SpecificBirthdayTodayTriggerArgs, state: SpecificBirthdayTodayTriggerState) => {
      // Validate that the current time matches the args.run_at time which has the format "HH:mm" and verify that the person is the same
      return !!args && !!state && this.isSamePerson(args.person, state.person) && typeof args.run_at === 'string' && this.verifyRunAtByArgs(args);
    });
    this.specificBirthdayTriggerCard.registerArgumentAutocompleteListener("person", this.autocompletePersons.bind(this));

    // Category birthday trigger card
    this.categoryBirthdayTriggerCard = this.homey.flow.getTriggerCard("category-birthday-today");
    this.categoryBirthdayTriggerCard.registerRunListener(async (args: CategoryBirthdayTriggerArgs, state: CategoryBirthdayTriggerState) => {
      // Validate that the current time matches the args.run_at time which has the format "HH:mm" and verify that the person belongs to the provided category
      return !!args?.category && !!state?.person && String(args.category.id).toLowerCase() === String(state.person.category || '').toLowerCase()
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
      if (!args?.person?.id) return false;
      const person = this.findPersonById(args.person.id);

      return this.isPersonsBirthday(person);
    });
    this.isSpecificBirthdayTodayConditionCard.registerArgumentAutocompleteListener("person", this.autocompletePersons.bind(this));

    this.homey.flow.getActionCard("temporary-image").registerRunListener(this.temporaryImageRunListener.bind(this));
    this.homey.flow.getActionCard("sync-ical-calendars").registerRunListener(async () => {
      const result = await this.syncIcalSources(true);
      const sources = Object.values(result.sources || {}) as Array<any>;
      return {
        birthdays: sources.reduce((total, source) => total + Number(source.count || 0), 0),
        successful_calendars: sources.filter(source => source.ok === true).length,
        failed_calendars: sources.filter(source => source.ok === false).length
      };
    });
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
    const today = this.getHomeyDateParts();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(person.dateOfBirth || '');
    if (!match) return 0;
    const birthdayKey = `${match[2]}-${match[3]}`;
    const todayKey = `${today.month}-${today.day}`;
    return Number(today.year) - Number(match[1]) - (todayKey < birthdayKey ? 1 : 0);
  }

  private getHomeyDateParts(): { year: string, month: string, day: string } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.homey.clock.getTimezone() || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return { year: parts.year, month: parts.month, day: parts.day };
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
      pl: "pl-PL", // Polish (Poland)
      ko: "ko-KR", // Korean (South Korea)
      ar: "ar-SA" // Arabic
    };

    return localeMappings[this.homey.i18n.getLanguage()] || "en-GB"; // Default to English (United Kingdom) if no mapping is found
  }

  private isSamePerson(personA: Person | undefined, personB: Person | undefined): boolean {
    return personA !== undefined && personB !== undefined && personA?.id === personB?.id;
  }
}

module.exports = Birthdays;


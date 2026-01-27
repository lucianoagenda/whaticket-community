import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import ShowUserService from "../UserServices/ShowUserService";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[]; // vamos IGNORAR isso pra não vazar
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  status,
  date,
  showAll,
  userId,
  withUnreadMessages
}: Request): Promise<Response> => {
  // Sempre pegar filas do usuário no backend (sem confiar no frontend)
  const user = await ShowUserService(userId);
  const userQueueIds = user.queues?.map(queue => queue.id) || [];

  const isAdmin = user.profile === "admin";

  // Base do include
  let includeCondition: Includeable[] = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "profilePicUrl"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["name"]
    }
  ];

  // Base do WHERE:
  // - Admin: não limita por fila
  // - Não-admin: limita por filas do usuário (e opcionalmente queueId null)
  let whereCondition: Filterable["where"];

  if (isAdmin) {
    whereCondition = {};
  } else {
    // IMPORTANTE:
    // Se você NÃO quer que usuários vejam tickets "sem fila", remova o `null` daqui.
    whereCondition = {
      queueId: { [Op.or]: [userQueueIds, null] }
    };
  }

  // Regra padrão do Whaticket: mostrar tickets do usuário OU pendentes
  // Mas SEM vazar para filas fora do escopo acima.
  if (!isAdmin) {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [{ userId }, { status: "pending" }]
    };
  } else {
    // Admin mantém comportamento original, mas sem filtro de fila
    whereCondition = {
      [Op.or]: [{ userId }, { status: "pending" }]
    };
  }

  // showAll: no padrão do Whaticket, "showAll" costuma mostrar tudo das filas selecionadas
  // Aqui: não-admin continua restrito às filas dele.
  if (showAll === "true") {
    if (isAdmin) {
      whereCondition = {}; // admin vê tudo
    } else {
      whereCondition = {
        queueId: { [Op.or]: [userQueueIds, null] }
      };
    }
  }

  // status específico
  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  // search
  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        where: {
          body: where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        required: false,
        duplicating: false
      }
    ];

    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          "$contact.name$": where(
            fn("LOWER", col("contact.name")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } },
        {
          "$message.body$": where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        }
      ]
    };
  }

  // date (mantive sua lógica, mas atenção: ela SOBRESCREVIA tudo antes)
  // Pra não furar o filtro de fila, a gente combina com o where existente.
  if (date) {
    whereCondition = {
      ...whereCondition,
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  // unread filter
  if (withUnreadMessages === "true") {
    whereCondition = {
      ...whereCondition,
      unreadMessages: { [Op.gt]: 0 }
    };

    // garante a regra original (userId OU pending) se alguém mexeu acima
    if (!isAdmin && showAll !== "true") {
      whereCondition = {
        ...whereCondition,
        [Op.or]: [{ userId }, { status: "pending" }]
      };
    }
  }

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["updatedAt", "DESC"]]
  });

  const hasMore = count > offset + tickets.length;

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;
